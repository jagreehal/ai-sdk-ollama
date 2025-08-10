import { ollama } from 'ai-sdk-ollama';
import { generateText } from 'ai';

async function main() {
  console.log('=== DeepSeek-R1 Reasoning Example ===\n');

  // Create a model with reasoning enabled using DeepSeek-R1
  const model = ollama('deepseek-r1:7b', { reasoning: true });

  // Test mathematical reasoning
  console.log('Testing mathematical reasoning with verification:\n');

  const result = await generateText({
    model,
    prompt:
      'Calculate the sum of all numbers from 1 to 10 and verify your answer using the formula n(n+1)/2.',
  });

  console.log('Response from DeepSeek-R1:');
  console.log(result.text);
  console.log('\n---\n');

  // Test without reasoning for comparison
  console.log('Same prompt without reasoning mode:\n');

  const modelNoReasoning = ollama('deepseek-r1:7b', { reasoning: false });

  const resultNoReasoning = await generateText({
    model: modelNoReasoning,
    prompt: 'Calculate the sum of all numbers from 1 to 10.',
  });

  console.log('Response without reasoning:');
  console.log(resultNoReasoning.text);
}

main().catch(console.error);
