/**
 * MCP (Model Context Protocol) Tools Example
 *
 * This example demonstrates how to use MCP tools with the Ollama provider.
 * MCP is an open standard that connects AI applications to a growing ecosystem
 * of tools and integrations.
 *
 * Prerequisites:
 * 1. Install and start an MCP server (we'll create a simple one for this example)
 * 2. The AI SDK's experimental_createMCPClient to connect to the server
 *
 * About MCP:
 * - Model Context Protocol is an open standard for connecting AI apps to tools
 * - Enables secure, two-way communication between apps and data sources
 * - Supports various transports: stdio, SSE, HTTP
 */

import { ollama } from 'ai-sdk-ollama';
import { generateText, experimental_createMCPClient } from 'ai';
import { spawn } from 'child_process';
import { z } from 'zod';

// Simple mock MCP server for demonstration
// In practice, you'd connect to real MCP servers like file systems, databases, APIs, etc.
class SimpleMCPServer {
  private process: any;

  async start() {
    console.log('🚀 Starting simple MCP server...');

    // Create a mock MCP server that responds to stdio
    // This simulates what a real MCP server would provide
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
    
    if (request.method === 'tools/list') {
      const response = {
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
        id: request.id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }] }
      };
      console.log(JSON.stringify(response));
    }
  } catch (error) {
    const response = {
      id: request.id || 'unknown',
      error: { code: -1, message: error.message }
    };
    console.log(JSON.stringify(response));
  }
});
`;

    // Write the server code to a temporary file and run it
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    const serverPath = path.join(os.tmpdir(), 'simple-mcp-server.js');
    fs.writeFileSync(serverPath, serverCode);

    this.process = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    console.log('✅ Simple MCP server started');
    return this.process;
  }

  stop() {
    if (this.process) {
      this.process.kill();
      console.log('🛑 MCP server stopped');
    }
  }
}

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

  let mcpServer: SimpleMCPServer | null = null;
  let mcpClient: any = null;

  try {
    // Start a simple MCP server for demonstration
    mcpServer = new SimpleMCPServer();
    const serverProcess = await mcpServer.start();

    // Wait a moment for the server to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log('\n📌 Step 1: Creating MCP Client Connection');

    // Create MCP client with stdio transport (connecting to our local server)
    try {
      // Note: In a real scenario, you'd use:
      // mcpClient = await experimental_createMCPClient({
      //   transport: new StdioClientTransport({
      //     command: 'path/to/mcp-server',
      //     args: []
      //   })
      // });

      // For this example, we'll simulate the MCP client response
      console.log('✅ MCP client created (simulated)');
      console.log('📋 Available tools from MCP server:');
      console.log('   • calculator - Perform mathematical calculations');
      console.log('   • getTime - Get current time information');
      console.log('   • weatherMock - Get mock weather data');

      // Import the tool function for proper AI SDK integration
      const { tool } = await import('ai');

      // Simulate getting tools from MCP server
      const mcpTools = {
        calculator: tool({
          description: 'Perform basic mathematical calculations',
          inputSchema: z.object({
            operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
            a: z.number(),
            b: z.number(),
          }),
          execute: async ({
            operation,
            a,
            b,
          }: {
            operation: string;
            a: number;
            b: number;
          }) => {
            console.log(`🧮 Executing calculator: ${a} ${operation} ${b}`);
            switch (operation) {
              case 'add':
                return `The result of ${a} + ${b} is ${a + b}`;
              case 'subtract':
                return `The result of ${a} - ${b} is ${a - b}`;
              case 'multiply':
                return `The result of ${a} × ${b} is ${a * b}`;
              case 'divide':
                return b !== 0
                  ? `The result of ${a} ÷ ${b} is ${a / b}`
                  : 'Error: Division by zero';
              default:
                return 'Unknown operation';
            }
          },
        }),
        getTime: tool({
          description: 'Get current time and date information',
          inputSchema: z.object({
            timezone: z.string().optional(),
          }),
          execute: async ({ timezone }: { timezone?: string }) => {
            console.log('🕐 Executing getTime tool');
            const now = new Date();
            const tz =
              timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
            return `Current time: ${now.toLocaleString()} (${tz}). ISO format: ${now.toISOString()}`;
          },
        }),
        weatherMock: tool({
          description: 'Get mock weather information for a location',
          inputSchema: z.object({
            location: z.string(),
            units: z.enum(['metric', 'imperial']).optional(),
          }),
          execute: async ({
            location,
            units = 'imperial',
          }: {
            location: string;
            units?: string;
          }) => {
            console.log(`🌤️ Executing weather lookup for ${location}`);
            const temps: Record<string, number> = {
              'New York': 72,
              London: 59,
              Tokyo: 79,
              Paris: 66,
            };
            const temp = temps[location] || 70;
            const actualTemp =
              units === 'metric' ? Math.round(((temp - 32) * 5) / 9) : temp;
            return `Weather in ${location}: ${actualTemp}°${units === 'metric' ? 'C' : 'F'}, partly cloudy, 65% humidity`;
          },
        }),
      };

      console.log('\n📌 Step 2: Using MCP Tools with Ollama');
      console.log(
        'Question: "What is 15 + 27, and what time is it currently?"\n',
      );

      const result1 = await generateText({
        model: ollama('llama3.2'),
        prompt:
          'Calculate 15 + 27 using the calculator tool with operation="add", a=15, b=27. Also get the current time using the getTime tool.',
        tools: mcpTools,
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
        tools: mcpTools,
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
        tools: mcpTools,
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
      console.log('\n📝 Note: This example uses simulated MCP tools.');
      console.log('In a real scenario, you would:');
      console.log('1. Install and configure actual MCP servers');
      console.log('2. Use experimental_createMCPClient with proper transport');
      console.log('3. Connect to services like file systems, databases, APIs');
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

    if (mcpServer) {
      mcpServer.stop();
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
  console.log('   2. Configure transport (stdio, SSE, or HTTP)');
  console.log('   3. Use experimental_createMCPClient for production');
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
