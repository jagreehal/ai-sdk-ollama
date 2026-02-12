/**
 * Tool call JSON repair example
 *
 * Demonstrates parseToolArguments from ai-sdk-ollama, which uses jsonrepair
 * to fix malformed tool-argument strings (trailing commas, unquoted keys, etc.).
 * The same repair runs automatically when using generateText/streamText with
 * tools and when converting messages with convertToOllamaChatMessages.
 *
 * Run: npx tsx src/tool-json-repair-example.ts
 */

import { parseToolArguments } from 'ai-sdk-ollama';

function run(
  label: string,
  input: string | Record<string, unknown>,
  expected: Record<string, unknown>,
) {
  console.log(`📝 ${label}`);
  console.log('   Input:', typeof input === 'string' ? input : JSON.stringify(input));
  const result = parseToolArguments(input);
  const ok = JSON.stringify(result) === JSON.stringify(expected);
  console.log('   Output:', JSON.stringify(result));
  console.log(ok ? '   ✅ Match' : '   ❌ Expected ' + JSON.stringify(expected));
  console.log();
}

function main() {
  console.log('🔧 Tool call JSON repair (parseToolArguments)\n');
  console.log('Uses jsonrepair when JSON.parse fails so model tool arguments are more reliable.\n');
  console.log('='.repeat(60));

  // Valid JSON
  run('Valid JSON string', '{"city": "Paris", "units": "celsius"}', {
    city: 'Paris',
    units: 'celsius',
  });

  // Malformed – repaired by jsonrepair
  run('Trailing comma', '{"query": "weather", "limit": 5,}', {
    query: 'weather',
    limit: 5,
  });
  run('Unquoted keys', '{name: "Alice", age: 30}', { name: 'Alice', age: 30 });
  run('Single quotes', "{'tool': 'search', 'q': 'test'}", {
    tool: 'search',
    q: 'test',
  });

  // Already an object (no parse)
  run('Object input (passthrough)', { location: 'NYC' }, { location: 'NYC' });

  // Edge cases
  run('Empty object string', '{}', {});
  run('Empty string → empty object', '', {});

  console.log('✨ Done. Tool argument repair is automatic in generateText/streamText and message conversion.');
}

main();
