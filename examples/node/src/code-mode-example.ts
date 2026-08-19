/**
 * Code Mode Example with Ollama
 *
 * Demonstrates @ai-sdk/code-mode with an Ollama model. Code mode lets the
 * model write JavaScript that calls tools concurrently, transforms results,
 * and returns a combined answer — all in an isolated QuickJS sandbox.
 */

import {
  DIRECT_TOOL_CALL,
  experimental_codeModeTool as codeModeTool,
  experimental_runCodeMode as runCodeMode,
} from '@ai-sdk/code-mode';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { GRANITE_4_MODEL as model } from './model';

const getInventory = tool({
  description: 'Get available inventory for a product.',
  inputSchema: z.object({
    productId: z.string(),
  }),
  outputSchema: z.object({
    productId: z.string(),
    availableUnits: z.number(),
  }),
  execute: async ({ productId }) => {
    console.log(`  [Tool] getInventory called for ${productId}`);
    return { productId, availableUnits: 42 };
  },
});

const getDemand = tool({
  description: 'Get requested units for a product.',
  inputSchema: z.object({
    productId: z.string(),
  }),
  outputSchema: z.object({
    productId: z.string(),
    requestedUnits: z.number(),
  }),
  execute: async ({ productId }) => {
    console.log(`  [Tool] getDemand called for ${productId}`);
    return { productId, requestedUnits: 31 };
  },
});

const tools = {
  code_mode: codeModeTool({
    executionPolicy: {
      timeoutMs: 30_000,
    },
  }),
  getInventory,
  getDemand,
} as const;

async function main() {
  // Tools listed in experimental_toolCallers are governed: the array value
  // controls WHO can invoke them. Without DIRECT_TOOL_CALL in the array,
  // the model can only reach these tools through code mode — they won't
  // appear as standalone tool-call options in the model's prompt.
  console.log('Example 1: Code Mode Only');
  console.log('=========================\n');

  const codeModeOnlyResult = await generateText({
    model,
    tools,
    experimental_toolCallers: {
      getInventory: ['code_mode'],
      getDemand: ['code_mode'],
    },
    stopWhen: isStepCount(10),
    prompt: 'Compare inventory and demand for product sku_123.',
  });

  console.log('\nFinal response:', codeModeOnlyResult.text);
  console.log('Steps taken:', codeModeOnlyResult.steps.length);

  for (const [i, step] of codeModeOnlyResult.steps.entries()) {
    const toolNames = step.toolCalls.map((tc) => tc.toolName).join(', ');
    if (toolNames) {
      console.log(`  Step ${i + 1}: tool calls — ${toolNames}`);
    }
  }

  // Adding DIRECT_TOOL_CALL to the array means the model can ALSO call
  // the tool directly (the classic one-at-a-time tool-call flow), in
  // addition to calling it from generated code. Use this when you want
  // the model to choose: simple lookups can go direct, while multi-tool
  // orchestration can go through code mode.
  console.log('\n\nExample 2: Code Mode + Direct Tool Calling');
  console.log('===========================================\n');

  const hybridResult = await generateText({
    model,
    tools,
    experimental_toolCallers: {
      getInventory: ['code_mode', DIRECT_TOOL_CALL],
      getDemand: ['code_mode', DIRECT_TOOL_CALL],
    },
    stopWhen: isStepCount(10),
    prompt: 'Compare inventory and demand for product sku_123.',
  });

  console.log('\nFinal response:', hybridResult.text);
  console.log('Steps taken:', hybridResult.steps.length);

  for (const [i, step] of hybridResult.steps.entries()) {
    const toolNames = step.toolCalls.map((tc) => tc.toolName).join(', ');
    if (toolNames) {
      console.log(`  Step ${i + 1}: tool calls — ${toolNames}`);
    }
  }

  // --- Example 3: Direct execution with runCodeMode ---
  console.log('\n\nDirect Execution (runCodeMode)');
  console.log('==============================\n');

  const directResult = await runCodeMode({
    js: `
      const [inventory, demand] = await Promise.all([
        tools.getInventory({ productId: 'sku_123' }),
        tools.getDemand({ productId: 'sku_123' }),
      ]);

      return {
        productId: inventory.productId,
        sufficient: inventory.availableUnits >= demand.requestedUnits,
        remaining: inventory.availableUnits - demand.requestedUnits,
      };
    `,
    tools: { getInventory, getDemand },
  });

  console.log('Result:', JSON.stringify(directResult, null, 2));
}

main().catch(console.error);
