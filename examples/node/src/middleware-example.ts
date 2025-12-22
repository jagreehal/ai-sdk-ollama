/**
 * Middleware Example
 *
 * Demonstrates the middleware system for wrapping language models.
 * Shows how to use wrapLanguageModel, defaultSettingsMiddleware,
 * and extractReasoningMiddleware.
 */

import {
  ollama,
  wrapLanguageModel,
  defaultSettingsMiddleware,
  extractReasoningMiddleware,
} from 'ai-sdk-ollama';
import { generateText, streamText } from 'ai';
import { MODELS, GRANITE_4_MODEL as model } from './model';

// Use a thinking model for reasoning extraction examples
// Cloud models (gpt-oss, deepseek-v3.1) support thinking mode
// Note: Cloud models require OLLAMA_API_KEY environment variable
const THINKING_MODEL: string = process.env.OLLAMA_API_KEY
  ? MODELS.GPT_OSS_120B_CLOUD  // Use gpt-oss (supports thinking mode)
  : MODELS.DEEPSEEK_R1_7B;      // Fallback to local thinking model


async function main() {
  console.log('=== Middleware Example ===\n');
  
  // Note about thinking models
  if (THINKING_MODEL === MODELS.GPT_OSS_120B_CLOUD) {
    console.log('ℹ️  Using cloud thinking model: gpt-oss:120b-cloud');
    console.log('   (Supports thinking mode with <think> tags)\n');
  } else if (THINKING_MODEL === MODELS.DEEPSEEK_V3_1_CLOUD) {
    console.log('ℹ️  Using cloud thinking model: deepseek-v3.1:671b-cloud');
    console.log('   (Supports thinking mode with <think> tags)\n');
  } else if (THINKING_MODEL === MODELS.DEEPSEEK_R1_7B) {
    console.log('ℹ️  Using local thinking model (deepseek-r1:7b)');
    console.log('   For better results, set OLLAMA_API_KEY to use cloud models\n');
  }

  // Example 1: Default Settings Middleware
  console.log('1. Default Settings Middleware:');
  console.log('   Apply default temperature and max tokens to all calls\n');

  const modelWithDefaults = wrapLanguageModel({
    model: ollama(MODELS.LLAMA_3_2),
    middleware: defaultSettingsMiddleware({
      settings: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    }),
  });

  const result1 = await generateText({
    model: modelWithDefaults,
    prompt: 'Write a haiku about coding.',
  });

  console.log('Result:', result1.text);
  console.log('---\n');

  // Example 2: Extract Reasoning Middleware
  console.log('2. Extract Reasoning Middleware:');
  console.log('   Extract <think> tags from model output');
  console.log(`   Using thinking model: ${THINKING_MODEL}\n`);

  const thinkingModel = ollama(THINKING_MODEL);
  const modelWithReasoning = wrapLanguageModel({
    model: thinkingModel,
    middleware: extractReasoningMiddleware({
      tagName: 'think',
      startWithReasoning: false,
    }),
  });

  // Note: This works best with models that natively output <think> tags
  // like DeepSeek-R1 or DeepSeek-V3.1
  try {
    const result2 = await generateText({
      model: modelWithReasoning,
      prompt: `Solve this step by step:
What is 15% of 80?`,
    });

    console.log('Result:', result2.text);
    console.log('---\n');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('not found') && process.env.OLLAMA_API_KEY) {
      console.log('⚠️  Cloud thinking model not available.');
      console.log('   Skipping reasoning extraction example.');
      console.log('   Note: Reasoning extraction requires a thinking model like gpt-oss or deepseek-v3.1\n');
    } else {
      console.log('⚠️  Error:', errorMsg);
      console.log('   Skipping reasoning extraction example.\n');
    }
  }

  // Example 3: Streaming with Extract Reasoning
  console.log('3. Streaming with Extract Reasoning:');
  console.log('   Extract reasoning from streamed output\n');

  try {
    const result3 = streamText({
      model: modelWithReasoning,
      prompt: `Think through this problem, then give the answer:
If a train travels at 60 mph for 2.5 hours, how far does it go?`,
    });

    process.stdout.write('Streaming: ');
    for await (const chunk of result3.textStream) {
      process.stdout.write(chunk);
    }
    console.log('\n---\n');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('not found')) {
      console.log('⚠️  Cloud thinking model not available for streaming. Skipping...\n');
    } else {
      console.log('⚠️  Error:', errorMsg);
      console.log('   Skipping streaming reasoning example.\n');
    }
  }

  // Example 4: Multiple Middlewares
  console.log('4. Multiple Middlewares:');
  console.log('   Combine default settings with reasoning extraction\n');

  try {
    const modelWithMultipleMiddlewares = wrapLanguageModel({
      model: ollama(THINKING_MODEL), // Use thinking model for reasoning extraction
      middleware: [
        defaultSettingsMiddleware({
          settings: {
            temperature: 0.5,
            maxOutputTokens: 1000,
          },
        }),
        extractReasoningMiddleware({
          tagName: 'think', // Thinking models use 'think' tag
        }),
      ],
    });

    const result4 = await generateText({
      model: modelWithMultipleMiddlewares,
      prompt: 'Explain what middleware is in software, briefly.',
    });

    console.log('Result:', result4.text);
    console.log('---\n');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('not found')) {
      console.log('⚠️  Cloud thinking model not available.');
      console.log('   Using regular model without reasoning extraction...\n');
      
      // Fallback: use regular model with just default settings
      const modelWithDefaultsOnly = wrapLanguageModel({
        model: ollama(MODELS.LLAMA_3_2),
        middleware: defaultSettingsMiddleware({
          settings: {
            temperature: 0.5,
            maxOutputTokens: 1000,
          },
        }),
      });

      const result4 = await generateText({
        model: modelWithDefaultsOnly,
        prompt: 'Explain what middleware is in software, briefly.',
      });

      console.log('Result:', result4.text);
      console.log('---\n');
    } else {
      throw error;
    }
  }

  // Example 5: Custom Model ID
  console.log('5. Custom Model ID with Middleware:');
  console.log('   Override the model ID for logging/tracking\n');

  const customIdModel = wrapLanguageModel({
    model: ollama(MODELS.LLAMA_3_2),
    middleware: defaultSettingsMiddleware({
      settings: { temperature: 0.8 },
    }),
    modelId: 'my-custom-llama',
    providerId: 'my-ollama-instance',
  });

  console.log('Model ID:', customIdModel.modelId);
  console.log('Provider:', customIdModel.provider);

  const result5 = await generateText({
    model: customIdModel,
    prompt: 'Say hello!',
  });

  console.log('Result:', result5.text);
  console.log('---\n');

  console.log('Middleware examples complete!');
}

main().catch((error) => {
  console.error('Middleware example failed:', error);
  process.exit(1);
});
