import { ollama } from 'ai-sdk-ollama';
import { generateText } from 'ai';

async function main() {
  // Create a model with reasoning enabled using DeepSeek-R1
  const model = ollama('deepseek-r1:7b', { reasoning: true });

  console.log('=== DeepSeek-R1 Reasoning Example ===\n');

  // Example 1: Mathematical reasoning with verification
  console.log('1. Mathematical reasoning and verification:');
  const result1 = await generateText({
    model,
    prompt:
      'Solve this problem and verify your answer: If I have 3 boxes, each containing 4 smaller boxes, and each smaller box has 5 items, how many items do I have in total? Double-check your calculation.',
  });

  console.log('Result:', result1.text);
  // Note: DeepSeek-R1 includes reasoning in the main text output with <think> tags
  // The reasoning is not returned separately in provider metadata
  console.log('\n');

  // Example 2: Logic puzzle with step-by-step reasoning
  console.log('2. Logic puzzle with detailed reasoning:');
  const result2 = await generateText({
    model,
    prompt:
      'Three friends - Alice, Bob, and Charlie - have different colored cars: red, blue, and green. Alice does not have the red car. Bob does not have the blue car. Charlie does not have the green car. What color car does each person have? Show your logical deduction.',
  });

  console.log('Result:', result2.text);
  // Note: DeepSeek-R1 includes reasoning in the main text output with <think> tags
  console.log('\n');

  // Example 3: Code verification and reasoning
  console.log('3. Code verification with reasoning:');
  const result3 = await generateText({
    model,
    prompt: `Analyze this JavaScript function and verify if it correctly calculates factorial:

function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

Test it with factorial(5) and verify the result step by step.`,
  });

  console.log('Code analysis result:', result3.text);
  // Note: DeepSeek-R1 includes reasoning in the main text output with <think> tags
  console.log('\n');

  // Example 4: Comparison with reasoning disabled
  console.log('4. Same problem without reasoning (for comparison):');
  const modelWithoutReasoning = ollama('deepseek-r1:7b', { reasoning: false });

  const result4 = await generateText({
    model: modelWithoutReasoning,
    prompt:
      'Solve this problem: If I have 3 boxes, each containing 4 smaller boxes, and each smaller box has 5 items, how many items do I have in total?',
  });

  console.log('Result (no reasoning visible):', result4.text);
}

main().catch((error) => {
  console.error('Reasoning example failed:', error);
  process.exit(1);
});
