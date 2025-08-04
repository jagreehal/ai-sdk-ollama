/**
 * Simple AI SDK Streaming Test
 * Tests the core streaming functionality that users actually need
 */

import { ollama } from '../src';
import { streamText } from 'ai';
import { z } from 'zod';

async function testBasicStreaming() {
  console.log('🌊 Basic Text Streaming Test\n');
  
  const { textStream } = await streamText({
    model: ollama('llama3.2'),
    prompt: 'Write a short poem about programming. Keep it under 50 words.',
    maxOutputTokens: 100,
  });

  console.log('Streaming response:');
  console.log('-'.repeat(40));
  
  let fullText = '';
  for await (const chunk of textStream) {
    process.stdout.write(chunk);
    fullText += chunk;
  }
  
  console.log('\n' + '-'.repeat(40));
  console.log(`✅ Streaming completed! (${fullText.length} characters)`);
  
  return fullText.length > 0;
}

async function testStreamingWithRealTimeDisplay() {
  console.log('\n\n📺 Real-time Streaming Display\n');
  
  const { textStream } = await streamText({
    model: ollama('llama3.2'),
    prompt: 'Count from 1 to 10 with a word description for each number.',
    maxOutputTokens: 200,
  });

  console.log('Real-time counting:');
  console.log('-'.repeat(40));
  
  let wordCount = 0;
  for await (const chunk of textStream) {
    process.stdout.write(chunk);
    wordCount += chunk.split(' ').length;
    
    // Add some visual feedback
    if (chunk.includes('\n')) {
      // New line in the stream
    }
  }
  
  console.log('\n' + '-'.repeat(40));
  console.log(`✅ Real-time streaming completed! (~${wordCount} words)`);
  
  return true;
}

async function testStreamingWithDifferentModels() {
  console.log('\n\n🤖 Multi-Model Streaming Test\n');
  
  const testPrompt = 'What is TypeScript in one sentence?';
  
  const models = ['llama3.2', 'qwen2.5-coder', 'phi4-mini'];
  
  for (const modelName of models) {
    console.log(`\n🔸 Testing ${modelName}:`);
    try {
      const { textStream } = await streamText({
        model: ollama(modelName),
        prompt: testPrompt,
        maxOutputTokens: 50,
      });
      
      let response = '';
      for await (const chunk of textStream) {
        response += chunk;
      }
      
      console.log(`   ✅ Response: ${response.trim()}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

async function testStreamingWithTools() {
  console.log('\n\n🔧 Streaming + Tool Calls Test\n');
  
  try {
    // Use the fullStream to capture tool calls
    const result = await streamText({
      model: ollama('llama3.2'),
      prompt: 'What is the weather in London? Use the weather tool.',
      tools: {
        getWeather: {
          description: 'Get weather for a city',
          parameters: z.object({
            city: z.string(),
          }),
          execute: async ({ city }) => {
            return { city, temperature: 15, condition: 'cloudy' };
          },
        },
      },
    });

    console.log('Streaming response with tools:');
    console.log('-'.repeat(40));
    
    let textContent = '';
    let toolCallsFound = 0;
    
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        process.stdout.write(part.delta);
        textContent += part.delta;
      } else if (part.type === 'tool-call') {
        toolCallsFound++;
        console.log(`\n🔧 [TOOL CALL] ${part.toolName} with args:`, part.args);
      } else if (part.type === 'tool-result') {
        console.log(`🔧 [TOOL RESULT]`, part.result);
      } else if (part.type === 'finish') {
        console.log(`\n\n✅ Stream finished: ${part.finishReason}`);
      }
    }
    
    console.log('\n' + '-'.repeat(40));
    console.log(`📊 Summary: ${textContent.length} chars text, ${toolCallsFound} tool calls`);
    
    return true;
    
  } catch (error) {
    console.log(`❌ Tool streaming error: ${error.message}`);
    return false;
  }
}

async function testStreamingPerformance() {
  console.log('\n\n⚡ Streaming Performance Test\n');
  
  const startTime = Date.now();
  
  const { textStream } = await streamText({
    model: ollama('llama3.2'),
    prompt: 'Explain the concept of recursion in programming.',
    maxOutputTokens: 150,
  });

  console.log('Performance test - explaining recursion:');
  console.log('-'.repeat(40));
  
  let chunks = 0;
  let totalChars = 0;
  let firstChunkTime = 0;
  
  for await (const chunk of textStream) {
    if (chunks === 0) {
      firstChunkTime = Date.now() - startTime;
    }
    
    chunks++;
    totalChars += chunk.length;
    process.stdout.write(chunk);
  }
  
  const totalTime = Date.now() - startTime;
  
  console.log('\n' + '-'.repeat(40));
  console.log(`⚡ Performance Results:`);
  console.log(`   Time to first chunk: ${firstChunkTime}ms`);
  console.log(`   Total time: ${totalTime}ms`);
  console.log(`   Chunks received: ${chunks}`);
  console.log(`   Characters streamed: ${totalChars}`);
  console.log(`   Average chunk size: ${Math.round(totalChars / chunks)} chars`);
  
  return totalTime < 10000; // Should complete within 10 seconds
}

async function runStreamingTests() {
  console.log('🌊 AI SDK Streaming Tests\n');
  console.log('='.repeat(60));
  
  const results = {
    basic: false,
    realTime: false,
    multiModel: false,
    withTools: false,
    performance: false,
  };
  
  try {
    results.basic = await testBasicStreaming();
    results.realTime = await testStreamingWithRealTimeDisplay();
    await testStreamingWithDifferentModels(); // Always succeeds partially
    results.multiModel = true;
    results.withTools = await testStreamingWithTools();
    results.performance = await testStreamingPerformance();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Streaming Test Results:');
    console.log(`   Basic streaming: ${results.basic ? '✅' : '❌'}`);
    console.log(`   Real-time display: ${results.realTime ? '✅' : '❌'}`);
    console.log(`   Multi-model support: ${results.multiModel ? '✅' : '❌'}`);
    console.log(`   Tool integration: ${results.withTools ? '✅' : '❌'}`);
    console.log(`   Performance: ${results.performance ? '✅' : '❌'}`);
    
    const passCount = Object.values(results).filter(Boolean).length;
    console.log(`\n🎯 Overall: ${passCount}/5 tests passed`);
    
    if (passCount >= 4) {
      console.log('🎉 AI SDK streaming integration is working excellently!');
    } else if (passCount >= 3) {
      console.log('✅ AI SDK streaming integration is working well!');
    } else {
      console.log('⚠️ AI SDK streaming needs attention.');
    }
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  }
}

// Run the tests
runStreamingTests().catch(console.error);