/**
 * Flow Stream Example - Handling Tool Calls in Flow-Based UIs
 *
 * This example demonstrates how to properly handle the fullStream when using
 * tool-calling models like gpt-oss:120b. These models often invoke tools
 * WITHOUT generating text first, which can cause flow interfaces to only
 * receive control events (start, finish) without any visible content.
 *
 * This example shows:
 * 1. Processing all stream part types via fullStream
 * 2. Handling empty text before tool calls gracefully
 * 3. Proper state tracking for flow-based UIs
 * 4. Aggregating tool calls and results
 *
 * Prerequisites:
 * - OLLAMA_API_KEY environment variable must be set
 * - Cloud models recommended (gpt-oss:120b-cloud, qwen3:480b-cloud)
 *
 * Usage:
 * npx tsx src/flow-stream-ai-sdk-ollama.ts [basic|verbose|ui-simulation]
 */

import { config } from 'dotenv';
import { ollama, streamText } from 'ai-sdk-ollama';
import { MODELS } from './model';

config();

const colors = {
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
};

/**
 * Flow state tracking for UI components
 * This is what a flow-based UI might track internally
 */
interface FlowState {
  // Text content state
  hasTextContent: boolean;
  textContent: string;
  textStarted: boolean;
  textEnded: boolean;

  // Tool call state
  toolCalls: Array<{
    id: string;
    toolName: string;
    input: Record<string, unknown>;
    status: 'calling' | 'completed' | 'error';
    result?: unknown;
  }>;

  // Overall state
  isStreaming: boolean;
  finishReason: string | null;
  hasError: boolean;
  errorMessage: string | null;
}

function createInitialFlowState(): FlowState {
  return {
    hasTextContent: false,
    textContent: '',
    textStarted: false,
    textEnded: false,
    toolCalls: [],
    isStreaming: true,
    finishReason: null,
    hasError: false,
    errorMessage: null,
  };
}

/**
 * Example 1: Enhanced fullStream processing
 * Shows the enhanced fullStream with synthesis support
 *
 * The ai-sdk-ollama's streamText now provides an enhanced fullStream that:
 * 1. Emits proper TextStreamPart objects (text-start, text-delta, text-end)
 * 2. Automatically synthesizes responses when tools execute but no text streams
 * 3. Works properly with flow-based UIs
 */
async function basicFullStreamExample() {
  console.log(colors.bold('\n📊 Example 1: Enhanced fullStream Processing'));
  console.log(colors.blue('Using ai-sdk-ollama\'s enhanced fullStream with synthesis...\n'));

  const stream = await streamText({
    model: ollama(MODELS.GPT_OSS_120B_CLOUD),
    prompt: 'Search for the latest TypeScript release and give me a brief summary.',
    tools: {
      webSearch: ollama.tools.webSearch(),
    },
  });

  let collectedText = '';
  let hasTextContent = false;
  let partCount = 0;

  console.log(colors.cyan('Stream Parts (fullStream):'));
  console.log(colors.gray('─'.repeat(60)));

  const timestamp = () => new Date().toISOString().split('T')[1].slice(0, 12);

  // Use the enhanced fullStream - now with synthesis support!
  for await (const part of stream.fullStream as AsyncIterable<any>) {
    partCount++;

    switch (part.type) {
      case 'start':
        console.log(colors.gray(`[${timestamp()}]`), colors.blue('START'));
        break;

      case 'text-start':
        console.log(colors.gray(`[${timestamp()}]`), colors.green('TEXT-START'), colors.dim(`id: ${part.id}`));
        break;

      case 'text-delta':
      case 'text-delta-text':
        hasTextContent = true;
        const textDelta = part.delta || part.text || '';
        collectedText += textDelta;
        console.log(colors.gray(`[${timestamp()}]`), colors.green('TEXT-DELTA'), colors.dim(`"${textDelta.slice(0, 50)}${textDelta.length > 50 ? '...' : ''}"`));
        break;

      case 'text-end':
        console.log(colors.gray(`[${timestamp()}]`), colors.green('TEXT-END'), colors.dim(`id: ${part.id}`));
        break;

      case 'tool-call':
        console.log(colors.gray(`[${timestamp()}]`), colors.yellow('TOOL-CALL'), colors.cyan(part.toolName));
        console.log(colors.gray('  └─'), colors.dim(`input: ${JSON.stringify(part.input)}`));
        break;

      case 'tool-result':
        console.log(colors.gray(`[${timestamp()}]`), colors.yellow('TOOL-RESULT'), colors.cyan(part.toolName));
        const output = part.output as any;
        if (output?.results) {
          console.log(colors.gray('  └─'), colors.dim(`${output.results.length} search results`));
        }
        break;

      case 'finish':
        console.log(colors.gray(`[${timestamp()}]`), colors.magenta('FINISH'), colors.dim(`reason: ${part.finishReason}`));
        break;

      default:
        console.log(colors.gray(`[${timestamp()}]`), colors.gray(part.type));
    }
  }

  console.log(colors.gray('─'.repeat(60)));
  console.log(colors.bold(`Total stream parts: ${partCount}`));

  // Summary
  if (!hasTextContent) {
    console.log(colors.yellow('\n⚠️  No text content was received'));
    console.log(colors.dim('   The synthesis feature should have generated text if tools were called'));
  } else {
    console.log(colors.green(`\n✅ Final text (${collectedText.length} chars):`));
    console.log(colors.dim(collectedText.slice(0, 300) + (collectedText.length > 300 ? '...' : '')));
  }

  console.log(colors.cyan('\n💡 Key: This fullStream now includes synthesis when model doesn\'t generate text'));
}

/**
 * Example 2: Verbose state tracking
 * Shows how a flow UI might track state through the stream
 */
async function verboseStateTrackingExample() {
  console.log(colors.bold('\n🔍 Example 2: Verbose State Tracking'));
  console.log(colors.blue('Tracking flow state as stream progresses...\n'));

  const state = createInitialFlowState();

  const stream = await streamText({
    model: ollama(MODELS.GPT_OSS_120B_CLOUD),
    prompt: 'Search for AI news today and summarize the top story.',
    tools: {
      webSearch: ollama.tools.webSearch(),
    },
  });

  function logState(event: string) {
    console.log(colors.cyan(`[${event}]`), colors.dim(JSON.stringify({
      hasText: state.hasTextContent,
      textLen: state.textContent.length,
      toolCalls: state.toolCalls.length,
      streaming: state.isStreaming,
    })));
  }

  logState('INITIAL');

  const timestamp = () => new Date().toISOString().split('T')[1].slice(0, 12);
  
  try {
    for await (const part of stream.fullStream as AsyncIterable<any>) {
      switch (part.type) {
        case 'start':
          logState('START');
          break;

        case 'text-start':
          if (!state.textStarted) {
            state.textStarted = true;
            state.hasTextContent = true;
            logState('TEXT-START');
          }
          break;

        case 'text-delta':
        case 'text-delta-text':
          state.hasTextContent = true;
          const delta = part.delta || part.text || '';
          state.textContent += delta;
          if (state.textContent.length % 100 < 10) {
            logState('TEXT-DELTA');
          }
          break;

        case 'text-end':
          if (state.textStarted && !state.textEnded) {
            state.textEnded = true;
            logState('TEXT-END');
          }
          break;

        case 'tool-call':
          const input = typeof part.input === 'string' ? JSON.parse(part.input) : part.input;
          state.toolCalls.push({
            id: part.toolCallId || '',
            toolName: part.toolName || '',
            input,
            status: 'calling',
          });
          console.log(colors.yellow(`[${timestamp()}]`), colors.cyan('TOOL-CALL'), colors.cyan(part.toolName || 'unknown'));
          console.log(colors.gray('  └─'), colors.dim(`input: ${JSON.stringify(input)}`));
          logState(`TOOL-CALL:${part.toolName}`);
          break;

        case 'tool-result':
          const existingCall = state.toolCalls.find(tc => tc.id === part.toolCallId);
          if (existingCall) {
            existingCall.status = 'completed';
            existingCall.result = part.output;
          }
          console.log(colors.yellow(`[${timestamp()}]`), colors.cyan('TOOL-RESULT'), colors.cyan(part.toolName || 'unknown'));
          const output = part.output as any;
          if (output?.results) {
            console.log(colors.gray('  └─'), colors.dim(`${output.results.length} search results`));
          }
          logState(`TOOL-RESULT:${part.toolName}`);
          break;

        case 'start-step':
        case 'finish-step':
          // Step events are handled by the AI SDK internally
          break;

        case 'finish':
          state.isStreaming = false;
          state.finishReason = part.finishReason || 'unknown';
          logState('FINISH');
          break;

        default:
          // Ignore unhandled event types
          break;
      }
    }
  } catch (error) {
    state.isStreaming = false;
    state.hasError = true;
    state.errorMessage = error instanceof Error ? error.message : String(error);
    logState('STREAM-ERROR');
    console.error(colors.red('Stream error:'), error);
  }

  // Fallback: Check toolCalls and toolResults promises after stream completes
  // Some models might expose tool calls only through promises, not stream events
  if (state.toolCalls.length === 0) {
    try {
      const toolCalls = await stream.toolCalls;
      if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
          const input = typeof call.input === 'string' ? JSON.parse(call.input) : call.input;
          state.toolCalls.push({
            id: call.toolCallId,
            toolName: call.toolName,
            input,
            status: 'calling',
          });
          console.log(colors.yellow(`[${timestamp()}]`), colors.cyan('TOOL-CALL'), colors.cyan(call.toolName));
          console.log(colors.gray('  └─'), colors.dim(`input: ${JSON.stringify(input)}`));
          logState(`TOOL-CALL:${call.toolName}`);
        }
      }
    } catch {
      // No tool calls available
    }

    try {
      const toolResults = await stream.toolResults;
      if (toolResults && toolResults.length > 0) {
        for (const result of toolResults) {
          const existingCall = state.toolCalls.find(tc => tc.id === result.toolCallId);
          if (existingCall) {
            existingCall.status = 'completed';
            existingCall.result = result.output;
          }
          console.log(colors.yellow(`[${timestamp()}]`), colors.cyan('TOOL-RESULT'), colors.cyan(result.toolName));
          logState(`TOOL-RESULT:${result.toolName}`);
        }
      }
    } catch {
      // No tool results available
    }
  }

  console.log(colors.bold('\n📋 Final Flow State:'));
  console.log(colors.gray('─'.repeat(60)));
  console.log(`  Text content received: ${state.hasTextContent ? colors.green('Yes') : colors.yellow('No')}`);
  console.log(`  Text length: ${colors.cyan(state.textContent.length.toString())} chars`);
  console.log(`  Tool calls made: ${colors.cyan(state.toolCalls.length.toString())}`);

  if (state.toolCalls.length === 0) {
    console.log(colors.yellow('  ⚠️  No tool calls detected in stream'));
  } else {
    for (const tc of state.toolCalls) {
      console.log(`    └─ ${colors.cyan(tc.toolName)}: ${tc.status === 'completed' ? colors.green('✓') : colors.red('✗')}`);
    }
  }

  console.log(`  Finish reason: ${colors.magenta(state.finishReason || 'unknown')}`);

  // Key insight for flow UIs
  if (!state.hasTextContent && state.toolCalls.length > 0) {
    console.log(colors.yellow('\n💡 Insight: Model invoked tools without generating text first'));
    console.log(colors.dim('   Flow UIs should handle this by showing a "Searching..." indicator'));
  } else if (state.toolCalls.length === 0) {
    console.log(colors.yellow('\n⚠️  Warning: No tool calls were detected'));
    console.log(colors.dim('   This might indicate:'));
    console.log(colors.dim('   - The model did not invoke any tools'));
    console.log(colors.dim('   - Tool calls were not properly streamed'));
    console.log(colors.dim('   - Check that tools are properly configured'));
  }
}

/**
 * Example 3: UI Simulation
 * Shows how a real flow-based UI might render the stream
 */
async function uiSimulationExample() {
  console.log(colors.bold('\n🖥️  Example 3: UI Simulation'));
  console.log(colors.blue('Simulating how a flow UI would render this stream...\n'));

  const stream = await streamText({
    model: ollama(MODELS.GPT_OSS_120B_CLOUD),
    prompt: 'Search for the weather in San Francisco today.',
    tools: {
      webSearch: ollama.tools.webSearch(),
    },
  });

  // UI state
  let currentSection: 'idle' | 'thinking' | 'searching' | 'responding' = 'idle';
  let textBuffer = '';
  let hasReceivedAnyContent = false;
  let toolResultCount = 0;

  function renderUI(section: typeof currentSection, detail?: string) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    const icons = {
      idle: '⚪',
      thinking: '🔄',
      searching: '🔍',
      responding: '💬',
    };

    // Clear previous line for streaming effect
    process.stdout.write(`\r${colors.gray(`[${timestamp}]`)} ${icons[section]} ${colors.bold(section.toUpperCase())}${detail ? ` ${colors.dim(detail)}` : ''}`.padEnd(80));
  }

  renderUI('thinking', 'Processing request...');

  // Use fullStream to track all events including tool calls
  try {
    for await (const part of stream.fullStream as AsyncIterable<any>) {
      switch (part.type) {
        case 'text-delta':
        case 'text-delta-text':
          if (!hasReceivedAnyContent) {
            hasReceivedAnyContent = true;
            currentSection = 'responding';
            renderUI('responding', 'Generating response...');
            console.log('');
          }
          const delta = part.delta || part.text || '';
          textBuffer += delta;
          process.stdout.write(delta);
          break;

        case 'tool-call':
          hasReceivedAnyContent = true;
          currentSection = 'searching';
          const input = typeof part.input === 'string' ? JSON.parse(part.input) : part.input;
          renderUI('searching', `${part.toolName}: "${(input as any).query || 'fetching...'}"`);
          console.log('');
          break;

        case 'tool-result':
          toolResultCount++;
          const output = part.output as any;
          if (output?.results) {
            console.log(colors.green(`  ✓ Found ${output.results.length} results`));
          }
          break;
      }
    }
    if (hasReceivedAnyContent && textBuffer.length > 0) {
      console.log('');
    }
  } catch (error) {
    console.error(colors.red('Stream error:'), error);
  }

  currentSection = 'idle';

  console.log(colors.gray('\n' + '─'.repeat(60)));

  // Final summary
  if (!hasReceivedAnyContent) {
    console.log(colors.red('⚠️  Stream completed without any content'));
    console.log(colors.dim('   This might indicate a model issue or API error'));
  } else if (textBuffer.length === 0) {
    console.log(colors.yellow('ℹ️  Tool calls completed but no final text response'));
    console.log(colors.cyan(`  Tool results: ${toolResultCount}`));
    console.log(colors.dim('   Flow UIs should show tool activity even when no text is generated'));
  } else {
    console.log(colors.green('✅ Stream completed successfully'));
    console.log(`   Text: ${textBuffer.length} characters`);
    console.log(colors.green('\n📝 Response:'));
    console.log(textBuffer);
  }
}

// Main execution
const args = process.argv.slice(2);
const example = args[0] || 'basic';

console.log(colors.bold('🌊 Flow Stream Example - Tool Call Handling'));
console.log(colors.blue('=============================================\n'));
console.log(colors.dim('This example demonstrates how to handle streams when models'));
console.log(colors.dim('invoke tools without generating text first.\n'));

if (!process.env.OLLAMA_API_KEY) {
  console.log(colors.yellow('⚠️  OLLAMA_API_KEY not found in environment variables'));
  console.log(colors.yellow('   Web search functionality will NOT work'));
  process.exit(1);
}

try {
  switch (example) {
    case 'basic':
      await basicFullStreamExample();
      break;
    case 'verbose':
      await verboseStateTrackingExample();
      break;
    case 'ui-simulation':
    case 'ui':
      await uiSimulationExample();
      break;
    default:
      console.log(colors.red(`❌ Unknown example: ${example}`));
      console.log(colors.cyan('Available examples: basic, verbose, ui-simulation'));
      process.exit(1);
  }
  console.log(colors.bold('\n🎉 Example completed!'));
} catch (error) {
  console.error(colors.red('\n❌ Error running example:'), error);
  process.exit(1);
}
