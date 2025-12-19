/**
 * AI SDK v6 - Tool Approval Example
 *
 * This example demonstrates the new tool approval system in AI SDK v6.
 * Tools can require user approval before execution using `needsApproval`.
 *
 * Note: This example simulates approval in a CLI context.
 * In a real app, you'd show a UI for approval.
 */

import { generateText, tool } from 'ai';
import { z } from 'zod';
import { GRANITE_4_MODEL as model } from './model';

// Tool that always requires approval
const deleteFileTool = tool({
  description: 'Delete a file from the system',
  inputSchema: z.object({
    filename: z.string().describe('The filename to delete'),
  }),
  needsApproval: true, // Always require approval
  execute: async ({ filename }) => {
    console.log(`  [Tool] Simulating deletion of: ${filename}`);
    return { success: true, message: `File ${filename} would be deleted` };
  },
});

// Tool with dynamic approval based on amount
const paymentTool = tool({
  description: 'Process a payment transaction',
  inputSchema: z.object({
    amount: z.number().describe('Amount in dollars'),
    recipient: z.string().describe('Payment recipient'),
  }),
  // Only require approval for amounts > $100
  needsApproval: async ({ amount }) => {
    console.log(`  [Approval Check] Amount: $${amount}`);
    return amount > 100;
  },
  execute: async ({ amount, recipient }) => {
    console.log(`  [Tool] Processing payment: $${amount} to ${recipient}`);
    return {
      success: true,
      transactionId: `TXN-${Date.now()}`,
      amount,
      recipient,
    };
  },
});

// Simple tool without approval
const weatherTool = tool({
  description: 'Get weather information',
  inputSchema: z.object({
    city: z.string().describe('City name'),
  }),
  execute: async ({ city }) => {
    console.log(`  [Tool] Getting weather for ${city}`);
    return { city, temperature: 72, condition: 'sunny' };
  },
});

async function main() {
  console.log('AI SDK v6 - Tool Approval Example');
  console.log('==================================\n');

  console.log('Example 1: Tool without approval (weather)');
  console.log('------------------------------------------');

  const weatherResult = await generateText({
    model,
    maxOutputTokens: 512,
    prompt: 'What is the weather in Miami?',
    tools: {
      weather: weatherTool,
    },
  });

  console.log('Response:', weatherResult.text || '(Tool called, no text)');
  console.log('Tool calls:', weatherResult.toolCalls.length);
  console.log();

  console.log('Example 2: Tool with static approval (delete)');
  console.log('---------------------------------------------');
  console.log('Note: Delete tool always requires approval.');
  console.log('The tool has needsApproval: true\n');

  // In a real application, you would handle the approval flow
  // through the UI using addToolApprovalResponse
  const deleteResult = await generateText({
    model,
    maxOutputTokens: 512,
    prompt: 'Delete the file named test.txt',
    tools: {
      deleteFile: deleteFileTool,
    },
  });

  console.log('Response:', deleteResult.text || '(Tool requested)');
  console.log('Tool calls:', deleteResult.toolCalls.length);
  if (deleteResult.toolCalls.length > 0) {
    console.log('Tool would request approval before execution');
  }
  console.log();

  console.log('Example 3: Tool with dynamic approval (payment)');
  console.log('-----------------------------------------------');
  console.log('Small amounts (<=$100) execute immediately.');
  console.log('Large amounts (>$100) require approval.\n');

  // Small payment - no approval needed
  console.log('Small payment ($50):');
  const smallPayment = await generateText({
    model,
    maxOutputTokens: 512,
    prompt: 'Send $50 to Alice for lunch',
    tools: {
      payment: paymentTool,
    },
  });
  console.log('Response:', smallPayment.text || '(Tool executed)');
  console.log();

  // Large payment - would need approval
  console.log('Large payment ($500):');
  const largePayment = await generateText({
    model,
    maxOutputTokens: 512,
    prompt: 'Send $500 to Bob for the project',
    tools: {
      payment: paymentTool,
    },
  });
  console.log('Response:', largePayment.text || '(Tool requested approval)');
  console.log();

  console.log('Tool approval examples completed!');
}

main().catch(console.error);
