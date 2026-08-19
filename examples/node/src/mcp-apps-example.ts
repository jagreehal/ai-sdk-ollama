/**
 * MCP Apps Host Example
 *
 * Demonstrates the MCP Apps host flow with Ollama:
 *   1. Connect to a local MCP server that serves ui:// resources
 *   2. Split tools by visibility (model-visible vs app-only)
 *   3. Pass only model-visible tools to generateText
 *   4. Read the ui:// HTML resource and fingerprint it
 *   5. Simulate iframe proxy: allow app-visible tool, deny others
 *
 * Prerequisites:
 *   - Ollama running with llama3.2 (or granite4)
 *   - @ai-sdk/mcp installed (included in this workspace)
 *
 * Run:
 *   npx tsx src/mcp-apps-example.ts
 *
 * Documentation:
 *   https://ai-sdk.dev/docs/ai-sdk-core/mcp-apps
 */

import { generateText } from 'ai';
import {
  createMCPClient,
  mcpAppClientCapabilities,
  splitMCPAppTools,
  readMCPAppResource,
  fingerprintMCPAppResource,
} from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { model } from './model';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('🧩 MCP Apps Host Example with Ollama\n');
  console.log('='.repeat(60));

  let client: Awaited<ReturnType<typeof createMCPClient>> | null = null;

  try {
    // ------------------------------------------------------------------
    // Step 1: Connect with MCP Apps capabilities
    // ------------------------------------------------------------------
    console.log('\n📌 Step 1: Connecting to MCP Apps server');

    const serverPath = path.join(__dirname, 'mcp-apps-server.mjs');

    client = await createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: 'node',
        args: [serverPath],
      }),
      clientName: 'ollama-mcp-apps-host',
      capabilities: mcpAppClientCapabilities,
    });

    console.log(`✅ Connected to "${client.serverInfo.name}" v${client.serverInfo.version}`);

    // ------------------------------------------------------------------
    // Step 2: List & split tools by MCP Apps visibility
    // ------------------------------------------------------------------
    console.log('\n📌 Step 2: Splitting tools by visibility');

    const definitions = await client.listTools();
    const { modelVisible, appVisible } = splitMCPAppTools(definitions);

    console.log(
      `   Model-visible tools: ${modelVisible.tools.map((t) => t.name).join(', ')}`,
    );
    console.log(
      `   App-visible tools:   ${appVisible.tools.map((t) => t.name).join(', ')}`,
    );

    // ------------------------------------------------------------------
    // Step 3: generateText with only model-visible tools
    // ------------------------------------------------------------------
    console.log('\n📌 Step 3: Calling generateText with model-visible tools');
    console.log('   Prompt: "Show me a dashboard about server usage"\n');

    const tools = client.toolsFromDefinitions(modelVisible);

    const result = await generateText({
      model,
      prompt:
        'Show me a dashboard about server usage. Use the showDashboard tool with topic "server usage".',
      tools: tools as Parameters<typeof generateText>[0]['tools'],
    });

    console.log('   Response:', result.text || '(no text — tool was called)');
    if (result.toolCalls?.length) {
      for (const tc of result.toolCalls) {
        console.log(`   ✅ Tool called: ${tc.toolName}(${JSON.stringify('args' in tc ? tc.args : tc.input)})`);
      }
    }

    // ------------------------------------------------------------------
    // Step 4: Read the ui:// resource and fingerprint it
    // ------------------------------------------------------------------
    console.log('\n📌 Step 4: Reading ui:// resource');

    const resource = await readMCPAppResource({
      client,
      uri: 'ui://ollama/dashboard',
    });

    console.log(`   URI:      ${resource.uri}`);
    console.log(`   MIME:     ${resource.mimeType}`);
    console.log(`   HTML:     ${resource.html.length} chars`);
    console.log(`   Meta:     ${JSON.stringify(resource.meta ?? {})}`);

    const fingerprint = await fingerprintMCPAppResource(resource);
    console.log(`   Fingerprint: ${fingerprint}`);

    console.log(`\n   HTML excerpt:\n   ${resource.html.slice(0, 200)}…`);

    // ------------------------------------------------------------------
    // Step 5: Simulate iframe proxy — allow / deny tool calls
    // ------------------------------------------------------------------
    console.log('\n📌 Step 5: Simulating iframe proxy');

    const appToolNames = new Set(appVisible.tools.map((t) => t.name));

    // Allowed: refreshDashboardData is app-visible
    const allowedTool = 'refreshDashboardData';
    if (appToolNames.has(allowedTool)) {
      console.log(`   ✅ "${allowedTool}" is app-visible — forwarding call`);
      const refreshResult = await client.callTool({
        name: allowedTool,
        arguments: { reason: 'Simulated iframe refresh' },
      });
      console.log(`   Result: ${JSON.stringify(refreshResult.content)}`);
    }

    // Denied: getWeather is NOT app-visible
    const deniedTool = 'getWeather';
    if (!appToolNames.has(deniedTool)) {
      console.log(
        `   🚫 "${deniedTool}" is NOT app-visible — request denied (403)`,
      );
    }

    // ------------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------------
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 MCP Apps Host Summary');
    console.log('='.repeat(60));
    console.log('\n✅ HOST FLOW DEMONSTRATED:');
    console.log('   1. Connected with mcpAppClientCapabilities');
    console.log('   2. Split tools: model sees showDashboard + getWeather');
    console.log('   3. App-only tool (refreshDashboardData) hidden from model');
    console.log('   4. Read ui:// HTML resource & fingerprinted it');
    console.log('   5. Proxy: allowed app-visible call, denied model-only call');
    console.log('\n📚 LEARN MORE:');
    console.log('   https://ai-sdk.dev/docs/ai-sdk-core/mcp-apps');
    console.log('   https://ai-sdk.dev/docs/reference/ai-sdk-core/mcp-apps');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MCP client closed');
    }
  }
}

main().catch((error) => {
  console.error('MCP Apps example failed:', error);
  process.exit(1);
});
