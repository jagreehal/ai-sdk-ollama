/**
 * Demonstration of model capabilities detection and user feedback
 */

import { ollama } from '../src';
import { generateText } from 'ai';
import { getModelInfo } from '../src/utils/model-capabilities';
import { suggestModelsForFeatures } from '../src/utils/model-suggestions';
import { z } from 'zod';

async function demonstrateModelCapabilities() {
  console.log('🔍 Model Capabilities Demo\n');
  console.log('='.repeat(60));

  // Test with different models to show capability detection
  const testModels = [
    'llama3.2',        // ✅ Supports tools
    'llama3',          // ❌ No tool support
    'phi4-mini',       // ❌ No tool support
    'unknown-model',   // ❌ Unknown model
  ];

  for (const modelId of testModels) {
    console.log(`\n📊 Testing model: ${modelId}`);
    console.log('-'.repeat(40));
    
    const modelInfo = getModelInfo(modelId);
    
    console.log(`Known model: ${modelInfo.isSupported ? '✅' : '❌'}`);
    console.log(`Tool calling: ${modelInfo.capabilities.supportsToolCalling ? '✅' : '❌'}`);
    console.log(`Vision: ${modelInfo.capabilities.supportsVision ? '✅' : '❌'}`);
    console.log(`JSON mode: ${modelInfo.capabilities.supportsJsonMode ? '✅' : '❌'}`);
    console.log(`Context window: ${modelInfo.capabilities.contextWindow.toLocaleString()} tokens`);
  }

  // Demonstrate model suggestions
  console.log('\n' + '='.repeat(60));
  console.log('\n🎯 Model Suggestions for Different Use Cases\n');

  const toolCallingSuggestions = suggestModelsForFeatures({ toolCalling: true });
  console.log('🔧 Best models for Tool Calling:');
  toolCallingSuggestions.slice(0, 3).forEach(suggestion => {
    console.log(`   • ${suggestion.modelId} - ${suggestion.reason}`);
  });

  const visionSuggestions = suggestModelsForFeatures({ vision: true });
  console.log('\n👁️  Best models for Vision:');
  visionSuggestions.slice(0, 3).forEach(suggestion => {
    console.log(`   • ${suggestion.modelId} - ${suggestion.reason}`);
  });

  const fastSuggestions = suggestModelsForFeatures({ performance: 'fast' });
  console.log('\n⚡ Fastest models:');
  fastSuggestions.slice(0, 3).forEach(suggestion => {
    console.log(`   • ${suggestion.modelId} - ${suggestion.reason}`);
  });

  // Demonstrate graceful handling of unsupported features
  console.log('\n' + '='.repeat(60));
  console.log('\n🛡️  Graceful Handling of Unsupported Features\n');

  console.log('Testing tool calling with llama3 (no tool support)...\n');
  
  try {
    const result = await generateText({
      model: ollama('llama3'), // This model doesn't support tools
      prompt: 'What is the weather in San Francisco?',
      tools: {
        getWeather: {
          description: 'Get weather for a location',
          parameters: z.object({
            location: z.string(),
          }),
        },
      },
    });

    console.log('Response:', result.text);
    console.log('Tool calls:', result.toolCalls?.length || 0);
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('\n⚠️  Warnings received:');
      result.warnings.forEach(warning => {
        console.log(`   • ${warning.type}: ${warning.details}`);
      });
    }
    
  } catch (error) {
    console.log('Error occurred:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✨ The library automatically:');
  console.log('   • Detects model capabilities');
  console.log('   • Provides helpful warnings');
  console.log('   • Suggests better models');
  console.log('   • Gracefully handles unsupported features');
  console.log('   • Works just like other AI SDK providers');
}

// Run the demonstration
demonstrateModelCapabilities().catch(console.error);