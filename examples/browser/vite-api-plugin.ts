import { Plugin } from 'vite';
import { createOllama } from 'ai-sdk-ollama';
import { streamText, convertToModelMessages } from 'ai';
import {
  createMCPClient,
  mcpAppClientCapabilities,
  splitMCPAppTools,
  readMCPAppResource,
  type MCPClient,
  type ListToolsResult,
} from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Sandbox-proxy HTML served at /mcp-app-sandbox.
// The outer iframe relays postMessage between host and the inner srcdoc frame.
// Copied from the official AI SDK reference implementation with the
// parent-source check for sandbox-resource-ready.
const sandboxProxyHtml = `<!doctype html>
<html><head><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;background:transparent}</style></head>
<body><script>
let appFrame;

function isJsonRpc(v){return v&&v.jsonrpc==='2.0'}

function createAppFrame(params){
  if(appFrame)appFrame.remove();
  appFrame=document.createElement('iframe');
  appFrame.sandbox=params.sandbox||'allow-scripts';
  appFrame.style.cssText='width:100%;height:100%;border:0';
  if(params.html)appFrame.srcdoc=params.html;
  document.body.appendChild(appFrame);
}

window.addEventListener('message',function(e){
  var data=e.data;
  if(!isJsonRpc(data))return;

  if(data.method==='ui/notifications/sandbox-resource-ready'){
    if(e.source!==window.parent)return;
    createAppFrame(data.params||{});
    return;
  }

  if(e.source===window.parent&&appFrame&&appFrame.contentWindow){
    appFrame.contentWindow.postMessage(data,'*');
    return;
  }

  if(appFrame&&e.source===appFrame.contentWindow){
    window.parent.postMessage(data,'*');
    return;
  }
});

window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/sandbox-ready'},'*');
</script></body></html>`;

export function apiPlugin(): Plugin {
  let mcpClient: MCPClient | null = null;
  let toolDefinitions: ListToolsResult | null = null;

  async function ensureMCPClient(): Promise<MCPClient> {
    if (mcpClient) return mcpClient;

    const serverPath = path.resolve(
      __dirname,
      '../node/src/mcp-apps-server.mjs',
    );

    mcpClient = await createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: 'node',
        args: [serverPath],
      }),
      clientName: 'browser-mcp-apps-host',
      capabilities: mcpAppClientCapabilities,
    });

    toolDefinitions = await mcpClient.listTools();
    console.log(
      '[mcp-apps] Connected, tools:',
      toolDefinitions!.tools.map((t) => t.name),
    );
    return mcpClient;
  }

  return {
    name: 'api-plugin',
    configureServer(server) {
      // Sandbox proxy route — serves the outer iframe HTML
      server.middlewares.use('/mcp-app-sandbox', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(sandboxProxyHtml);
      });

      // Read ui:// resource
      server.middlewares.use(
        '/api/mcp-app-host/read-resource',
        async (req, res, next) => {
          if (req.method !== 'POST') return next();
          try {
            const { uri } = JSON.parse(await readBody(req));
            const client = await ensureMCPClient();
            const resource = await readMCPAppResource({ client, uri });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(resource));
          } catch (error) {
            console.error('[mcp-apps] read-resource error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read resource' }));
          }
        },
      );

      // Proxy app-visible tool calls
      server.middlewares.use(
        '/api/mcp-app-host/call-tool',
        async (req, res, next) => {
          if (req.method !== 'POST') return next();
          try {
            const { name, arguments: toolArguments } = JSON.parse(
              await readBody(req),
            );
            const client = await ensureMCPClient();
            if (!toolDefinitions) {
              toolDefinitions = await client.listTools();
            }
            const { appVisible } = splitMCPAppTools(toolDefinitions);
            const isAllowed = appVisible.tools.some((t) => t.name === name);
            if (!isAllowed) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Tool is not app-visible' }));
              return;
            }
            const result = await client.callTool({
              name,
              arguments: toolArguments ?? {},
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error) {
            console.error('[mcp-apps] call-tool error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Tool call failed' }));
          }
        },
      );

      // Chat route — includes model-visible MCP tools alongside Ollama
      server.middlewares.use('/api/chat', async (req, res, next) => {
        if (req.method !== 'POST') {
          return next();
        }

        try {
          const body = await readBody(req);

          try {
            const { messages, model = 'llama3.2:latest' } = JSON.parse(body);

            if (!messages || !Array.isArray(messages)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid messages format' }));
              return;
            }

            const ollama = createOllama({
              baseURL: 'http://localhost:11434',
            });

            // Get model-visible MCP tools
            let mcpTools: Record<string, unknown> = {};
            try {
              const client = await ensureMCPClient();
              if (!toolDefinitions) {
                toolDefinitions = await client.listTools();
              }
              const { modelVisible } = splitMCPAppTools(toolDefinitions);
              mcpTools = client.toolsFromDefinitions(modelVisible);
            } catch (err) {
              console.warn('[mcp-apps] Could not load MCP tools:', err);
            }

            const result = await streamText({
              model: ollama(model),
              messages: convertToModelMessages(messages),
              tools: mcpTools as Parameters<typeof streamText>[0]['tools'],
              system:
                'You are a helpful assistant. When the user asks for a dashboard, use the showDashboard tool.',
            });

            const response = result.toUIMessageStreamResponse();

            res.writeHead(
              response.status,
              Object.fromEntries(response.headers.entries()),
            );

            if (response.body) {
              const reader = response.body.getReader();
              const pump = async () => {
                const { done, value } = await reader.read();
                if (done) {
                  res.end();
                  return;
                }
                res.write(value);
                pump();
              };
              pump();
            } else {
              res.end();
            }
          } catch (error) {
            console.error('Chat API error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        } catch (error) {
          console.error('API middleware error:', error);
          next();
        }
      });
    },
  };
}
