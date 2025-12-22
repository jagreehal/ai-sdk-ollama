/**
 * MCP (Model Context Protocol) Tools Example
 *
 * This example demonstrates how to use MCP tools with the Ollama provider.
 * MCP is an open standard that connects AI applications to a growing ecosystem
 * of tools and integrations.
 *
 * Prerequisites:
 * 1. Install @ai-sdk/mcp: npm install @ai-sdk/mcp
 * 2. This example creates a simple MCP server for demonstration
 * 3. In production, you'd connect to real MCP servers (file systems, databases, APIs, etc.)
 *
 * About MCP:
 * - Model Context Protocol is an open standard for connecting AI apps to tools
 * - Enables secure, two-way communication between apps and data sources
 * - Supports various transports: stdio, SSE, HTTP
 * - Uses createMCPClient from @ai-sdk/mcp (stable in AI SDK v6)
 * - Note: Transport classes still use Experimental_ prefix
 *
 * Documentation:
 * - https://sdk.vercel.ai/docs/ai-sdk-core/tools/mcp-tools
 * - https://modelcontextprotocol.info
 */

import { ollama } from 'ai-sdk-ollama';
import { generateText } from 'ai';
import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';

async function demonstrateMCPTools() {
  console.log('🔗 MCP (Model Context Protocol) Tools with Ollama\n');
  console.log('='.repeat(60));
  console.log(
    'This example shows how to use MCP tools with the Ollama provider.',
  );
  console.log(
    'MCP enables connecting to external tools and services securely.',
  );
  console.log('='.repeat(60));

  let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null;

  try {

    console.log('\n📌 Step 1: Creating MCP Client Connection');

    // Create MCP client with stdio transport (connecting to our local server)
    try {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      const serverPath = path.join(os.tmpdir(), 'simple-mcp-server.js');
      const serverCode = `
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const tools = {
  calculator: {
    name: 'calculator',
    description: 'Perform basic mathematical calculations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide']
        },
        a: { type: 'number' },
        b: { type: 'number' }
      },
      required: ['operation', 'a', 'b']
    }
  },
  getTime: {
    name: 'getTime',
    description: 'Get current time and date information',
    inputSchema: {
      type: 'object',
      properties: {
        timezone: { type: 'string', description: 'Timezone (optional)' }
      }
    }
  },
  weatherMock: {
    name: 'weatherMock',
    description: 'Get mock weather information for a location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
        units: { type: 'string', enum: ['metric', 'imperial'], description: 'Temperature units' }
      },
      required: ['location']
    }
  }
};

rl.on('line', (input) => {
  try {
    const request = JSON.parse(input);
    
    // Handle MCP initialization
    if (request.method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'simple-mcp-server',
            version: '1.0.0'
          }
        }
      };
      console.log(JSON.stringify(response));
      return;
    }
    
    // Handle initialized notification (sent after initialize)
    if (request.method === 'notifications/initialized') {
      return; // No response needed for notifications
    }
    
    if (request.method === 'tools/list') {
      const response = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: Object.values(tools)
        }
      };
      console.log(JSON.stringify(response));
    } else if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params;
      let result;
      
      switch (name) {
        case 'calculator':
          const { operation, a, b } = args;
          switch (operation) {
            case 'add': result = { result: a + b }; break;
            case 'subtract': result = { result: a - b }; break;
            case 'multiply': result = { result: a * b }; break;
            case 'divide': result = { result: b !== 0 ? a / b : 'Error: Division by zero' }; break;
            default: result = { error: 'Unknown operation' };
          }
          break;
          
        case 'getTime':
          const now = new Date();
          result = {
            timestamp: now.toISOString(),
            local: now.toLocaleString(),
            timezone: args.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
          };
          break;
          
        case 'weatherMock':
          const temps = { 'New York': 72, 'London': 59, 'Tokyo': 79, 'Paris': 66 };
          const temp = temps[args.location] || 70;
          result = {
            location: args.location,
            temperature: args.units === 'metric' ? Math.round((temp - 32) * 5/9) : temp,
            units: args.units || 'imperial',
            condition: 'Partly cloudy',
            humidity: 65
          };
          break;
          
        default:
          result = { error: 'Unknown tool' };
      }
      
      const response = {
        jsonrpc: '2.0',
        id: request.id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }] }
      };
      console.log(JSON.stringify(response));
    }
  } catch (error) {
    const response = {
      jsonrpc: '2.0',
      id: request?.id || 'unknown',
      error: { code: -1, message: error.message }
    };
    console.log(JSON.stringify(response));
  }
});
`;

      // Write the server code to a temporary file
      fs.writeFileSync(serverPath, serverCode);

      // Create MCP client (AI SDK v6 - createMCPClient is stable, transport classes still use Experimental_ prefix)
      mcpClient = await createMCPClient({
        transport: new Experimental_StdioMCPTransport({
          command: 'node',
          args: [serverPath],
        }),
      });

      console.log('✅ MCP client created');
      console.log('📋 Fetching available tools from MCP server...');

      // Get tools from the MCP server
      const mcpTools = await mcpClient.tools();

      console.log('✅ Tools retrieved from MCP server:');
      console.log(
        `   • ${Object.keys(mcpTools).join(', ')} - Available from MCP server`,
      );

      console.log('\n📌 Step 2: Using MCP Tools with Ollama');
      console.log(
        'Question: "What is 15 + 27, and what time is it currently?"\n',
      );

      const result1 = await generateText({
        model: ollama('llama3.2'),
        prompt:
          'Calculate 15 + 27 using the calculator tool with operation="add", a=15, b=27. Also get the current time using the getTime tool.',
        // MCP tools work seamlessly with AI SDK v6
        tools: mcpTools as Parameters<typeof generateText>[0]['tools'],
      });

      console.log('Final Response:', result1.text);
      if (result1.toolCalls && result1.toolCalls.length > 0) {
        console.log('\n✅ MCP tools were called successfully!');
        for (const toolCall of result1.toolCalls) {
          console.log(`- ${toolCall.toolName}: executed`);
        }
      }

      console.log('\n' + '='.repeat(60));
      console.log('\n📌 Step 3: Multiple MCP Tools in One Request');
      console.log(
        'Question: "What\'s the weather in Tokyo and calculate 100 divided by 4?"\n',
      );

      const result2 = await generateText({
        model: ollama('llama3.2'),
        prompt:
          'Get the weather in Tokyo using the weatherMock tool and calculate 100 divided by 4 using the calculator tool.',
        tools: mcpTools as Parameters<typeof generateText>[0]['tools'],
      });

      console.log('Final Response:', result2.text);
      if (result2.toolCalls && result2.toolCalls.length > 0) {
        console.log('\n✅ Multiple MCP tools used successfully!');
        for (const toolCall of result2.toolCalls) {
          console.log(`- ${toolCall.toolName}: executed`);
        }
      }

      if (result2.toolResults && result2.toolResults.length > 0) {
        console.log('\n📋 Tool Results:');
        for (const toolResult of result2.toolResults) {
          console.log(`- ${toolResult.toolName}: executed successfully`);
        }
      }

      console.log('\n' + '='.repeat(60));
      console.log('\n📌 Step 4: MCP Tools with Tool Choice Control');
      console.log('Testing forced tool usage with MCP tools\n');

      const result3 = await generateText({
        model: ollama('llama3.2'),
        prompt: 'Tell me the current time.',
        tools: mcpTools as Parameters<typeof generateText>[0]['tools'],
        toolChoice: 'required', // Force tool usage
      });

      console.log('Final Response:', result3.text);
      if (result3.toolCalls && result3.toolCalls.length > 0) {
        console.log('\n✅ Forced MCP tool usage successful!');
        for (const toolCall of result3.toolCalls) {
          console.log(`- ${toolCall.toolName}: executed`);
        }
      }

      if (result3.toolResults && result3.toolResults.length > 0) {
        console.log('\n📋 Tool Results:');
        for (const toolResult of result3.toolResults) {
          console.log(`- ${toolResult.toolName}: executed successfully`);
        }
      }
    } catch (clientError) {
      console.error('❌ MCP client creation failed:', clientError);
      console.log(
        '\n📝 Note: Make sure you have @ai-sdk/mcp installed and the MCP server is running correctly.',
      );
      throw clientError;
    }
  } catch (error) {
    console.error('❌ Error in MCP demonstration:', error);
  } finally {
    // Clean up resources
    if (mcpClient) {
      try {
        await mcpClient.close();
        console.log('\n🔌 MCP client connection closed');
      } catch (closeError) {
        console.error('Warning: Error closing MCP client:', closeError);
      }
    }

  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 MCP Tools Summary');
  console.log('='.repeat(60));
  console.log('\n✅ BENEFITS OF MCP WITH OLLAMA:');
  console.log('   • Access to external tools and services');
  console.log('   • Standardized protocol for tool integration');
  console.log('   • Secure, controlled access to resources');
  console.log('   • Works with any AI SDK provider including Ollama');
  console.log('   • Supports stdio, SSE, and HTTP transports');

  console.log('\n🔧 REAL-WORLD MCP SERVERS:');
  console.log('   • File system access (reading/writing files)');
  console.log('   • Database connections (SQL queries)');
  console.log('   • API integrations (REST/GraphQL)');
  console.log('   • Cloud services (AWS, Google Cloud, Azure)');
  console.log('   • Development tools (Git, Docker, etc.)');

  console.log('\n📚 NEXT STEPS:');
  console.log('   1. Install real MCP servers from the MCP ecosystem');
  console.log('   2. Configure transport using Experimental_StdioMCPTransport, SSEMCPTransport, or HTTPMCPTransport');
  console.log('   3. Connect using createMCPClient (stable in AI SDK v6, as shown in this example)');
  console.log('   4. Explore the growing MCP server ecosystem');

  console.log('\n🌐 LEARN MORE:');
  console.log('   • https://modelcontextprotocol.info - Official MCP site');
  console.log(
    '   • https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#mcp-tools',
  );
  console.log('   • https://github.com/modelcontextprotocol - MCP on GitHub');
}

// Run the demonstration
demonstrateMCPTools().catch((error) => {
  console.error('MCP demonstration failed:', error);
  process.exit(1);
});
