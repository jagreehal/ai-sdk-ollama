/**
 * Web Search Examples
 *
 * Demonstrates Ollama's web search and fetch capabilities with the AI SDK.
 * Based on patterns from: https://ollama.com/blog/web-search
 *
 * Prerequisites:
 * - OLLAMA_API_KEY environment variable must be set
 * - Cloud models recommended (gpt-oss:120b-cloud, qwen3:480b-cloud)
 *
 * Usage:
 * npx tsx src/web-search-example.ts [basic|fetch|combined|streaming|error]
 */

import { config } from 'dotenv';
import { ollama, generateText, streamText } from 'ai-sdk-ollama';
import { MODELS } from './model';

// Load environment variables
config();

// Color utilities
const colors = {
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

// Helper function to display tool execution results
function displayToolExecution(result: any) {
  const hasTools = result.toolCalls && result.toolCalls.length > 0;
  const hasText = result.text && result.text.length > 0;
  
  if (hasTools || hasText) {
    console.log(colors.yellow('\n🔧 Tool Execution:'));
    
    if (result.toolCalls && result.toolCalls.length > 0) {
      result.toolCalls.forEach((call: any, index: number) => {
        console.log(colors.cyan(`${index + 1}. ${call.toolName}`));
        const input = typeof call.input === 'string' ? JSON.parse(call.input) : call.input;
        if (call.toolName === 'webSearch') {
          console.log(`   Query: "${input.query}"`);
        } else if (call.toolName === 'webFetch') {
          console.log(`   URL: ${input.url}`);
        }
      });

      if (result.toolResults && result.toolResults.length > 0) {
        result.toolResults.forEach((toolResult: any) => {
          const output = toolResult.output;
          if (toolResult.toolName === 'webSearch') {
            if (output && 'results' in output && output.results && output.results.length > 0) {
              console.log(colors.green(`   ✅ Search: ${output.results.length} results`));
              console.log(colors.cyan(`   First: ${output.results[0].title}`));
            } else {
              console.log(colors.red('   ❌ Search: No results'));
            }
          } else if (toolResult.toolName === 'webFetch') {
            if (output && output.content && output.content.length > 0) {
              console.log(colors.green(`   ✅ Fetch: ${output.content.length} chars`));
            } else if (output && output.error) {
              console.log(colors.red(`   ❌ Fetch error: ${output.error}`));
            } else {
              console.log(colors.red('   ❌ Fetch: No content'));
            }
          }
        });
      }
    }
    
    if (hasText) {
      console.log(colors.green(`   ✅ Response: ${result.text.length} characters`));
    }
  } else {
    console.log(colors.red('❌ No tools executed and no response generated'));
  }
}

/**
 * Example 1: Basic web search
 */
async function basicWebSearchExample() {
  console.log(colors.bold('\n🔍 Example 1: Basic Web Search'));
  console.log(colors.blue('Searching for current AI news...\n'));

  try {
    const result = await generateText({
      model: ollama(MODELS.GPT_OSS_120B_CLOUD),
      prompt: 'Search for latest AI news and give me a 10-word summary.',
      tools: {
        webSearch: ollama.tools.webSearch(),
      },
    });

    console.log(colors.green('🤖 AI Response:'));
    console.log(result.text);
    displayToolExecution(result);

    return result;
  } catch (error) {
    console.error(colors.red('❌ Error:'), error);
    throw error;
  }
}

/**
 * Example 2: Web fetch only
 */
async function webFetchOnlyExample() {
  console.log(colors.bold('\n📄 Example 2: Web Fetch Only'));
  console.log(colors.blue('Fetching content from a specific URL...\n'));

  try {
    const result = await generateText({
      model: ollama(MODELS.GPT_OSS_120B_CLOUD),
      prompt: 'Fetch content from https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/ and give me a 10-word summary.',
      tools: {
        webFetch: ollama.tools.webFetch(),
      },
    });

    console.log(colors.green('🤖 AI Response:'));
    console.log(result.text);
    displayToolExecution(result);

    return result;
  } catch (error) {
    console.error(colors.red('❌ Error:'), error);
    throw error;
  }
}

/**
 * Example 3: Combined search and fetch
 */
async function combinedSearchAndFetchExample() {
  console.log(colors.bold('\n🌐 Example 3: Combined Search and Fetch'));
  console.log(colors.blue('Search + fetch TypeScript news, 10-word summary...\n'));

  try {
    const result = await generateText({
      model: ollama(MODELS.GPT_OSS_120B_CLOUD),
      prompt: 'STEP 1: Use webSearch tool to search for "TypeScript 5.0 features". STEP 2: Use webFetch tool to fetch the URL from the first search result. STEP 3: Give me a 10-word summary. You MUST complete all 3 steps.',
      tools: {
        webSearch: ollama.tools.webSearch(),
        webFetch: ollama.tools.webFetch(),
      },
    });

    console.log(colors.green('🤖 AI Response:'));
    console.log(result.text);
    displayToolExecution(result);

    return result;
  } catch (error) {
    console.error(colors.red('❌ Error:'), error);
    throw error;
  }
}

/**
 * Example 4: Streaming with web search
 */
async function streamingWebSearchExample() {
  console.log(colors.bold('\n🚀 Example 4: Streaming Web Search'));
  console.log(colors.blue('Streaming space news with 10-word summary...\n'));

  try {
    const stream = await streamText({
      model: ollama(MODELS.GPT_OSS_120B_CLOUD),
      prompt: 'Search for space news and stream a 10-word summary.',
      tools: {
        webSearch: ollama.tools.webSearch(),
      },
    });

    console.log(colors.green('🤖 Streaming Response:'));
    console.log(colors.blue('===================================='));

    // Stream the text response
    try {
      for await (const chunk of stream.textStream) {
        process.stdout.write(chunk);
      }
    } catch (streamError) {
      console.log(colors.yellow('\n⚠️  Stream ended (normal for tool calls)'));
    }

    // Show tool execution details
    try {
      const toolCalls = await stream.toolCalls;
      if (toolCalls && toolCalls.length > 0) {
        console.log(colors.yellow('\n🔧 Tool Execution:'));
        toolCalls.forEach((call: any, index: number) => {
          console.log(colors.cyan(`${index + 1}. ${call.toolName}`));
          const input = typeof call.input === 'string' ? JSON.parse(call.input) : call.input;
          if (call.toolName === 'webSearch') {
            console.log(`   Search Query: "${input.query}"`);
          }
        });

        const toolResults = await stream.toolResults;
        if (toolResults && toolResults.length > 0) {
          toolResults.forEach((toolResult: any) => {
            const output = toolResult.output;
            if (toolResult.toolName === 'webSearch') {
              if (output && 'results' in output && output.results && output.results.length > 0) {
                console.log(colors.green(`   ✅ Search: ${output.results.length} results`));
                console.log(colors.cyan(`   First: ${output.results[0].title}`));
              } else {
                console.log(colors.red('   ❌ Search: No results'));
              }
            }
          });
        }
      } else {
        console.log(colors.red('❌ No web search performed'));
      }
    } catch (toolError) {
      console.log(colors.yellow('⚠️  Tool handling completed'));
    }

    console.log(colors.green('\n\n✨ Streaming completed!'));

    return stream;
  } catch (error) {
    console.error(colors.red('❌ Error:'), error);
  }
}

/**
 * Example 5: Error handling
 */
async function errorHandlingExample() {
  console.log(colors.bold('\n⚠️  Example 5: Error Handling'));
  console.log(colors.blue('Testing web fetch with invalid URL...\n'));

  try {
    const result = await generateText({
      model: ollama(MODELS.GPT_OSS_120B_CLOUD),
      prompt: 'Try to fetch https://invalid-url-12345.com and give me a 10-word summary.',
      tools: {
        webFetch: ollama.tools.webFetch(),
      },
    });

    console.log(colors.green('🤖 AI Response:'));
    console.log(result.text);
    displayToolExecution(result);

    return result;
  } catch (error) {
    console.error(colors.red('❌ Error:'), error);
    throw error;
  }
}

// Main execution
const args = process.argv.slice(2);
const example = args[0] || 'basic';

console.log(colors.bold(`🌟 Running ${example} example`));
console.log(colors.blue('====================================\n'));

// Check API key
if (!process.env.OLLAMA_API_KEY) {
  console.log(colors.yellow('⚠️  OLLAMA_API_KEY not found in environment variables'));
  console.log(colors.yellow('   Web search functionality will NOT work'));
  process.exit(1);
}

// Run example
try {
  switch (example) {
    case 'basic':
      await basicWebSearchExample();
      break;
    case 'fetch':
      await webFetchOnlyExample();
      break;
    case 'combined':
      await combinedSearchAndFetchExample();
      break;
    case 'streaming':
      await streamingWebSearchExample();
      break;
    case 'error':
      await errorHandlingExample();
      break;
    default:
      console.log(colors.red(`❌ Unknown example: ${example}`));
      console.log(colors.cyan('Available examples: basic, fetch, combined, streaming, error'));
      process.exit(1);
  }
  console.log(colors.bold('\n🎉 Example completed!'));
} catch (error) {
  console.error(colors.red('❌ Error running example:'), error);
  process.exit(1);
}
