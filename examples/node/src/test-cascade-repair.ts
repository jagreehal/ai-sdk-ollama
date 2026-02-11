import { generateText, Output } from 'ai';
import { ollama, cascadeRepairText, enhancedRepairText } from 'ai-sdk-ollama';
import { z } from 'zod';

/**
 * Example: Cascade repair (object-generation-reliability)
 *
 * Exercises packages/ai-sdk-ollama/src/utils/object-generation-reliability.ts:
 * - cascadeRepairText (jsonrepair → enhancedRepairText)
 * - enhancedRepairText (Ollama-specific fallback)
 * - Default repair selection via generateText objectGenerationOptions
 *
 * Run: pnpm exec tsx src/test-cascade-repair.ts
 * With LLM: pnpm exec tsx src/test-cascade-repair.ts --llm
 */

async function main() {
  console.log('🔧 Cascade Repair Example (object-generation-reliability)\n');
  console.log('='.repeat(60));

  // -------------------------------------------------------------------------
  // Example 1–5: cascadeRepairText (default = jsonrepair then enhancedRepairText)
  // -------------------------------------------------------------------------
  console.log('\n📌 Cascade repair (cascadeRepairText)\n');
  console.log(
    'Uses object-generation-reliability: jsonrepair first, then enhancedRepairText.\n',
  );

  const runRepair = async (
    label: string,
    malformed: string,
    check?: (parsed: unknown) => void,
  ) => {
    console.log(`📝 ${label}`);
    try {
      const repaired = await cascadeRepairText({
        text: malformed,
        error: new Error('parse failed'),
      });
      if (!repaired) {
        console.log('  ❌ No repair returned');
        return;
      }
      const parsed = JSON.parse(repaired);
      console.log('  ✅ Repaired:', repaired);
      if (check) check(parsed);
    } catch (e) {
      console.log('  ❌ Failed:', (e as Error).message);
    }
    console.log();
  };

  await runRepair('Example 1: Trailing comma', '{"name": "John", "age": 30,}');
  await runRepair('Example 2: Unquoted keys', '{name: "John", age: 30}');
  await runRepair(
    'Example 3: Python constants (fallback to enhancedRepairText)',
    '{"name": "John", "active": True, "value": None}',
    (p) => {
      console.log('  📊 name:', (p as { name: string }).name);
      console.log(
        '  📊 active:',
        (p as { active: boolean }).active,
        '(True→true)',
      );
      console.log('  📊 value:', (p as { value: null }).value, '(None→null)');
    },
  );
  await runRepair(
    'Example 4: URLs with // in strings',
    "{'url': 'https://example.com', 'name': 'Test'}",
    (p) => console.log('  📊 url:', (p as { url: string }).url),
  );
  await runRepair(
    'Example 5: Smart quotes in strings',
    '{"message": "He said "hello" and smiled"}',
    (p) => console.log('  📊 message:', (p as { message: string }).message),
  );

  // -------------------------------------------------------------------------
  // Example 6–7: enhancedRepairText directly (same module, fallback path)
  // -------------------------------------------------------------------------
  console.log('='.repeat(60));
  console.log('\n📌 Legacy repair (enhancedRepairText only)\n');
  console.log(
    'Direct calls to enhancedRepairText from object-generation-reliability.\n',
  );

  console.log('📝 Example 6: Python constants via enhancedRepairText');
  try {
    const repaired = await enhancedRepairText({
      text: '{"active": True, "value": None}',
      error: new Error('test'),
    });
    if (repaired) {
      const parsed = JSON.parse(repaired);
      console.log('  ✅ Repaired:', repaired);
      console.log('  📊 active:', (parsed as { active: boolean }).active);
      console.log('  📊 value:', (parsed as { value: null }).value);
    } else {
      console.log('  ❌ No repair returned');
    }
  } catch (e) {
    console.log('  ❌ Failed:', (e as Error).message);
  }
  console.log();

  console.log('📝 Example 7: Single quotes via enhancedRepairText');
  try {
    const repaired = await enhancedRepairText({
      text: "{'x': 1, 'y': 2}",
      error: new Error('test'),
    });
    if (repaired) {
      JSON.parse(repaired);
      console.log('  ✅ Repaired:', repaired);
    } else {
      console.log('  ❌ No repair returned');
    }
  } catch (e) {
    console.log('  ❌ Failed:', (e as Error).message);
  }

  try {
    console.log(
      '📝 Example 8: Default cascade repair (objectGenerationOptions not set)',
    );
    const result1 = await generateText({
      model: ollama('llama3.2', {
        structuredOutputs: true,
        reliableObjectGeneration: true,
        // Default: getRepairFunction() returns cascadeRepairText
      }),
      output: Output.object({
        schema: z.object({
          name: z.string(),
          website: z.string(),
          active: z.boolean(),
        }),
      }),
      prompt:
        'Return JSON: name "TechCorp", website "https://techcorp.com", active true',
    });
    console.log('  ✅ Output:', JSON.stringify(result1.output, null, 2));
    console.log();

    console.log('📝 Example 9: Custom repairText (enhancedRepairText only)');
    const result2 = await generateText({
      model: ollama('llama3.2', {
        structuredOutputs: true,
        reliableObjectGeneration: true,
        objectGenerationOptions: { repairText: enhancedRepairText },
      }),
      output: Output.object({
        schema: z.object({ title: z.string(), description: z.string() }),
      }),
      prompt: 'Return JSON: title "AI", description "Short post about AI"',
    });
    console.log('  ✅ Output:', JSON.stringify(result2.output, null, 2));
    console.log();

    console.log('📝 Example 10: Explicit cascadeRepairText (same as default)');
    const result3 = await generateText({
      model: ollama('llama3.2', {
        structuredOutputs: true,
        reliableObjectGeneration: true,
        objectGenerationOptions: { repairText: cascadeRepairText },
      }),
      output: Output.object({
        schema: z.object({ message: z.string(), count: z.number() }),
      }),
      prompt: 'Return JSON: message "hello", count 42',
    });
    console.log('  ✅ Output:', JSON.stringify(result3.output, null, 2));
    console.log();
  } catch (error) {
    console.error('❌ LLM examples failed:', error);
    throw error;
  }

  console.log('✨ Cascade repair examples completed.');
}

main().catch((error) => {
  console.error('Cascade repair example failed:', error);
  process.exit(1);
});
