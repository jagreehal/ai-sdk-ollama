/**
 * Minimal stdio MCP server that demonstrates MCP Apps.
 *
 * Exposes:
 *   tools:
 *     - showDashboard      visibility: ["model","app"], resourceUri: ui://ollama/dashboard
 *     - refreshDashboardData  visibility: ["app"]  (app-only, hidden from model)
 *     - getWeather          no _meta.ui (ordinary model tool)
 *
 *   resources:
 *     - ui://ollama/dashboard  (text/html;profile=mcp-app)
 *
 * No external dependencies — uses Node readline over stdio.
 */

import { createInterface } from 'node:readline';

const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';
const DASHBOARD_URI = 'ui://ollama/dashboard';

// ---------------------------------------------------------------------------
// Dashboard HTML served as a ui:// resource
// ---------------------------------------------------------------------------

function dashboardHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Ollama MCP App Dashboard</title>
<style>
  :root {
    color-scheme: light dark;
    font-family: system-ui, sans-serif;
    background: var(--color-background-primary, #ffffff);
    color: var(--color-text-primary, #171717);
  }
  body { margin: 0; padding: 16px; }
  .card {
    border: 1px solid var(--color-border-primary, #d4d4d4);
    border-radius: 12px; padding: 16px;
    background: var(--color-background-secondary, #fafafa);
  }
  .eyebrow {
    margin: 0 0 8px;
    color: var(--color-text-secondary, #525252);
    font-size: 12px; text-transform: uppercase; letter-spacing: .08em;
  }
  h1 { margin: 0; font-size: 20px; }
  p  { line-height: 1.5; }
  .grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin: 16px 0; }
  .metric {
    border: 1px solid var(--color-border-primary, #d4d4d4);
    border-radius: 8px; padding: 10px;
    background: var(--color-background-primary, #ffffff);
  }
  .label { color: var(--color-text-secondary, #525252); font-size: 12px; }
  .value { margin-top: 4px; font-size: 18px; font-weight: 600; }
  button {
    border: 1px solid var(--color-border-primary, #d4d4d4);
    border-radius: 8px; padding: 8px 12px;
    background: var(--color-background-primary, #ffffff);
    color: inherit; cursor: pointer;
  }
</style>
</head>
<body>
<div class="card">
  <p class="eyebrow">MCP App</p>
  <h1>Ollama Dashboard</h1>
  <p>This HTML is served from a <code>ui://</code> resource and rendered in a sandboxed iframe.</p>

  <div class="grid" id="cards">
    <div class="metric"><div class="label">Requests</div><div class="value">128</div></div>
    <div class="metric"><div class="label">Latency</div><div class="value">42 ms</div></div>
    <div class="metric"><div class="label">Status</div><div class="value">Healthy</div></div>
  </div>

  <button id="refresh">Call app-only refresh tool</button>
  <span id="status">Connecting to host…</span>
</div>

<script>
const cards  = document.getElementById('cards');
const status = document.getElementById('status');
let nextId = 1;
const pending = new Map();

function send(method, params) {
  const id = nextId++;
  pending.set(id, method);
  window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
  return id;
}

function notify(method, params) {
  window.parent.postMessage({ jsonrpc: '2.0', method, params }, '*');
}

function renderCards(result) {
  const items = result?.structuredContent?.cards;
  if (!Array.isArray(items)) return;
  cards.textContent = '';
  for (const c of items) {
    const m = document.createElement('div'); m.className = 'metric';
    const l = document.createElement('div'); l.className = 'label'; l.textContent = String(c.label);
    const v = document.createElement('div'); v.className = 'value'; v.textContent = String(c.value);
    m.append(l, v);
    cards.append(m);
  }
}

window.addEventListener('message', e => {
  const msg = e.data;
  if (msg?.jsonrpc !== '2.0') return;

  if (msg.id != null && pending.has(msg.id)) {
    const method = pending.get(msg.id);
    pending.delete(msg.id);
    if (method === 'ui/initialize') {
      status.textContent = 'Connected to host.';
      notify('ui/notifications/initialized');
    } else if (method === 'tools/call') {
      status.textContent = 'Refreshed via app-only tool.';
      renderCards(msg.result);
    }
    return;
  }

  if (msg.method === 'ui/notifications/tool-result') {
    renderCards(msg.params);
  }
});

document.getElementById('refresh').addEventListener('click', () => {
  send('tools/call', {
    name: 'refreshDashboardData',
    arguments: { reason: 'User clicked refresh in the MCP App' },
  });
});

send('ui/initialize', {
  protocolVersion: '2026-01-26',
  appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
  appInfo: { name: 'ollama-mcp-app-demo', version: '1.0.0' },
});
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Tool definitions (returned by tools/list)
// ---------------------------------------------------------------------------

const toolDefinitions = [
  {
    name: 'showDashboard',
    description:
      'Show an interactive MCP App dashboard for a topic. The host renders the result as a sandboxed HTML app.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The dashboard topic to display, such as usage or weather.',
        },
      },
      required: ['topic'],
    },
    _meta: {
      ui: {
        resourceUri: DASHBOARD_URI,
        visibility: ['model', 'app'],
      },
    },
  },
  {
    name: 'refreshDashboardData',
    description:
      'Refresh dashboard data. Intended for the MCP App UI, not the model.',
    inputSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
      },
    },
    _meta: {
      ui: {
        resourceUri: DASHBOARD_URI,
        visibility: ['app'],
      },
    },
  },
  {
    name: 'getWeather',
    description: 'Get the current weather for a city.',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'The city to get weather for.' },
      },
      required: ['city'],
    },
  },
];

// ---------------------------------------------------------------------------
// Resource definitions (returned by resources/list)
// ---------------------------------------------------------------------------

const resourceDefinitions = [
  {
    uri: DASHBOARD_URI,
    name: 'Dashboard App',
    description: 'Interactive dashboard rendered by an MCP Apps host.',
    mimeType: MCP_APP_MIME_TYPE,
    _meta: { ui: { prefersBorder: true } },
  },
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

function executeTool(name, args) {
  switch (name) {
    case 'showDashboard': {
      const topic = args?.topic ?? 'general';
      return {
        content: [
          { type: 'text', text: `Rendered an MCP App dashboard for "${topic}".` },
        ],
        structuredContent: {
          topic,
          cards: [
            { label: 'Requests', value: 128 },
            { label: 'Latency', value: '42 ms' },
            { label: 'Status', value: 'Healthy' },
          ],
        },
        _meta: { ui: { resourceUri: DASHBOARD_URI } },
      };
    }

    case 'refreshDashboardData': {
      return {
        content: [
          {
            type: 'text',
            text: `Dashboard refreshed${args?.reason ? `: ${args.reason}` : ''}.`,
          },
        ],
        structuredContent: {
          refreshedAt: new Date().toISOString(),
          cards: [
            { label: 'Requests', value: 143 },
            { label: 'Latency', value: '39 ms' },
            { label: 'Status', value: 'Healthy' },
          ],
        },
      };
    }

    case 'getWeather': {
      const city = args?.city ?? 'Unknown';
      return {
        content: [
          { type: 'text', text: `The weather in ${city} is sunny and 72 °F.` },
        ],
        structuredContent: {
          city,
          condition: 'sunny',
          temperature: 72,
          unit: 'fahrenheit',
        },
      };
    }

    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC stdio handler
// ---------------------------------------------------------------------------

const rl = createInterface({ input: process.stdin });

function reply(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(msg + '\n');
}

function replyError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
  process.stdout.write(msg + '\n');
}

rl.on('line', (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }

  const { method, id, params } = request;

  switch (method) {
    case 'initialize':
      reply(id, {
        protocolVersion: '2025-11-25',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'ollama-mcp-apps-demo', version: '1.0.0' },
      });
      break;

    case 'notifications/initialized':
      break;

    case 'tools/list':
      reply(id, { tools: toolDefinitions });
      break;

    case 'tools/call':
      reply(id, executeTool(params?.name, params?.arguments));
      break;

    case 'resources/list':
      reply(id, { resources: resourceDefinitions });
      break;

    case 'resources/read': {
      const uri = params?.uri;
      if (uri === DASHBOARD_URI) {
        reply(id, {
          contents: [
            {
              uri: DASHBOARD_URI,
              mimeType: MCP_APP_MIME_TYPE,
              text: dashboardHtml(),
              _meta: {
                ui: {
                  prefersBorder: true,
                  csp: { connectDomains: [], resourceDomains: [], frameDomains: [] },
                },
              },
            },
          ],
        });
      } else {
        replyError(id, -32602, `Unknown resource: ${uri}`);
      }
      break;
    }

    default:
      if (id != null) {
        replyError(id, -32601, `Method not found: ${method}`);
      }
  }
});
