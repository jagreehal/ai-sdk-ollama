/**
 * Repairing malformed JSON emitted by local models.
 *
 * Ollama models routinely produce JSON that is *nearly* valid: block comments,
 * Python literals (`True`/`None`), smart quotes from instruction tuning, or a
 * whole object wrapped in a quoted string. `jsonrepair` handles the common
 * cases; the passes here cover the Ollama-specific ones it does not, and every
 * one of them is careful to leave string contents alone.
 */

import type { JSONSchema7 } from '@ai-sdk/provider';
import { safeParseJSON } from '@ai-sdk/provider-utils';
import { jsonrepair } from 'jsonrepair';

const WHITESPACE_CHARS = new Set([' ', '\t', '\n']);
const STRUCTURAL_CLOSE_CHARS = new Set(['}', ']']);
const KEY_START_CHARS = new Set(['"', '\u201C', '_', '$']);
const VALUE_START_CHARS = new Set([
  '"',
  '\u201C',
  '{',
  '[',
  '-',
  't',
  'T',
  'f',
  'F',
  'n',
  'N',
]);
const SMART_SINGLE_QUOTE_CHARS = new Set([
  '\u2018',
  '\u2019',
  '\u0060',
  '\u00B4',
]);

/**
 * A function that attempts to repair the raw output of the model
 * to enable JSON parsing and validation.
 *
 * Similar to AI SDK's RepairTextFunction but tailored for Ollama's output patterns.
 */
export type RepairTextFunction = (options: {
  text: string;
  error: Error;
  schema?: JSONSchema7 | unknown;
}) => Promise<string | null>;

/**
 * Remove block comments (slash-star ... star-slash) but only when outside strings
 */
function removeBlockCommentsOutsideStrings(text: string): string {
  let result = '';
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  while (index < text.length) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (escaped) {
      result += char;
      escaped = false;
      index++;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      index++;
      continue;
    }

    // Track quote state
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      result += char;
      index++;
      continue;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += char;
      index++;
      continue;
    }

    // Check for block comment start /* when NOT inside a string
    if (char === '/' && nextChar === '*' && !inSingleQuote && !inDoubleQuote) {
      // Skip until we find */
      index += 2; // Skip /*
      while (index < text.length - 1) {
        if (text[index] === '*' && text[index + 1] === '/') {
          index += 2; // Skip */
          break;
        }
        index++;
      }
      continue;
    }

    result += char;
    index++;
  }

  return result;
}

/**
 * Replace Python constants (None, True, False) but only when outside strings
 */
function replacePythonConstantsOutsideStrings(text: string): string {
  let result = '';
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  while (index < text.length) {
    const char = text[index];

    if (escaped) {
      result += char;
      escaped = false;
      index++;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      index++;
      continue;
    }

    // Track quote state
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      result += char;
      index++;
      continue;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += char;
      index++;
      continue;
    }

    // Only process replacements when NOT inside a string
    if (!inSingleQuote && !inDoubleQuote) {
      // Check for Python constants with word boundaries
      const remaining = text.slice(index);
      const noneRegex = /^\bNone\b/;
      const trueRegex = /^\bTrue\b/;
      const falseRegex = /^\bFalse\b/;

      if (noneRegex.test(remaining)) {
        result += 'null';
        index += 4; // Skip "None"
        continue;
      } else if (trueRegex.test(remaining)) {
        result += 'true';
        index += 4; // Skip "True"
        continue;
      } else if (falseRegex.test(remaining)) {
        result += 'false';
        index += 5; // Skip "False"
        continue;
      }
    }

    result += char;
    index++;
  }

  return result;
}

/**
 * Replace smart quotes with regular quotes, but only when outside strings.
 * This prevents corruption of string values that intentionally contain smart quotes.
 *
 * Smart quotes replaced:
 * - Single: \u2018 ('), \u2019 ('), \u0060 (`), \u00B4 (´) → '
 * - Double: \u201C ("), \u201D (") → "
 */
function replaceSmartQuotesOutsideStrings(text: string): string {
  let result = '';
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inSmartDoubleQuote = false; // Track smart double quotes (\u201C and \u201D)
  let escaped = false;

  while (index < text.length) {
    const char = text[index];

    if (escaped) {
      result += char;
      escaped = false;
      index++;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      index++;
      continue;
    }

    // Track quote state - including smart quotes as delimiters
    if (char === "'" && !inDoubleQuote && !inSmartDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      result += char;
      index++;
      continue;
    } else if (char === '"' && !inSingleQuote && !inSmartDoubleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += char;
      index++;
      continue;
    } else if (
      char === '\u201C' &&
      !inSingleQuote &&
      !inDoubleQuote &&
      !inSmartDoubleQuote
    ) {
      // Opening smart double quote (\u201C) - start of smart-quoted string
      inSmartDoubleQuote = true;
      result += '"'; // Convert to regular quote
      index++;
      continue;
    } else if (char === '\u201D' && inSmartDoubleQuote) {
      // Check if this is the closing quote by looking ahead
      // If we're inside a smart-quoted string and see \u201D, we need to determine
      // if it's closing the current string or if it's an inner quote.
      // We'll use a heuristic: if we're at end-of-text OR the next non-whitespace
      // character is a structural character that cannot be inside a string value.
      let isClosing = false;
      let index_ = index + 1;

      // Skip whitespace
      while (index_ < text.length) {
        const nextChar = text[index_];
        if (!nextChar) {
          break;
        }
        if (WHITESPACE_CHARS.has(nextChar)) {
          index_++;
          continue;
        }

        // Check for } or ] - these are structural characters that cannot be inside strings
        if (STRUCTURAL_CLOSE_CHARS.has(nextChar)) {
          isClosing = true;
          break;
        }

        // Check for , - this can be inside strings OR a field separator
        // If , is followed by whitespace and then a new key (starts with " or smart quote), it's likely closing a value
        if (nextChar === ',') {
          let k = index_ + 1;
          // Skip whitespace after comma
          while (k < text.length) {
            const afterComma = text[k];
            if (!afterComma) {
              break;
            }
            if (WHITESPACE_CHARS.has(afterComma)) {
              k++;
              continue;
            }
            // If comma is followed by a key-starting character, it's likely a field separator
            // Key-starting chars: quote, smart quote, unquoted key (letter, underscore, dollar), or numeric key (digit followed by colon)
            if (
              KEY_START_CHARS.has(afterComma) ||
              (afterComma >= 'a' && afterComma <= 'z') ||
              (afterComma >= 'A' && afterComma <= 'Z')
            ) {
              isClosing = true;
              break; // Found key-starting character, exit comma check loop
            } else if (afterComma >= '0' && afterComma <= '9') {
              // Check if digit is followed by colon (numeric key like "2: value")
              let m = k + 1;
              while (m < text.length) {
                const afterDigit = text[m];
                if (!afterDigit) {
                  break;
                }
                if (WHITESPACE_CHARS.has(afterDigit)) {
                  m++;
                  continue;
                }
                if (afterDigit === ':') {
                  isClosing = true;
                  break; // Found colon, exit early
                }
                // Not a colon, so not a numeric key
                break;
              }
              // If we found a numeric key, break out of comma check loop
              if (isClosing) {
                break;
              }
            }
            // Otherwise, comma is likely part of string content
            break;
          }
          // If we determined the comma is a field separator, break out of outer loop
          if (isClosing) {
            break;
          }
        }

        // Check for : - this is tricky because it can be inside strings OR a key-value separator
        // If : is followed by whitespace and then a value-starting character, it's likely closing a key
        if (nextChar === ':') {
          let k = index_ + 1;
          // Skip whitespace after colon
          while (k < text.length) {
            const afterColon = text[k];
            if (!afterColon) {
              break;
            }
            if (WHITESPACE_CHARS.has(afterColon)) {
              k++;
              continue;
            }
            // If colon is followed by a value-starting character, it's likely a key-value separator
            // Value-starting chars: ", {, [, digit, -, t/T (true/True), f/F (false/False), n/N (null/None), smart quotes
            if (
              VALUE_START_CHARS.has(afterColon) ||
              (afterColon >= '0' && afterColon <= '9')
            ) {
              isClosing = true;
            }
            // Otherwise, colon is likely part of string content
            break;
          }
        }

        break;
      }

      // If we reached end-of-text (no more characters), it's closing
      if (index_ >= text.length) {
        isClosing = true;
      }

      if (isClosing) {
        // Closing smart double quote (\u201D) - end of smart-quoted string
        inSmartDoubleQuote = false;
        result += '"'; // Convert to regular quote
        index++;
        continue;
      }
      // Otherwise, it's an inner smart quote - preserve it
    }

    // Only replace smart quotes when NOT inside any string
    if (!inSingleQuote && !inDoubleQuote && !inSmartDoubleQuote) {
      // Replace smart single quotes
      if (char !== undefined && SMART_SINGLE_QUOTE_CHARS.has(char)) {
        result += "'";
        index++;
        continue;
      }
      // Replace smart double quotes when not used as delimiters
      if (char === '\u201C' || char === '\u201D') {
        result += '"';
        index++;
        continue;
      }
    }

    // Inside strings (including smart-quoted strings), preserve all characters
    result += char;
    index++;
  }

  return result;
}

/**
 * Handles common JSON issues from LLM outputs
 */
export async function enhancedRepairText(options: {
  text: string;
  error: Error;
  schema?: JSONSchema7 | unknown;
}): Promise<string | null> {
  const { text } = options;
  let repaired = text.trim();

  try {
    // 0. Handle JSON wrapped in quotes (e.g., "{\"key\": \"value\"}")
    // Check if the entire text is a quoted JSON string
    if (
      (repaired.startsWith('"') && repaired.endsWith('"')) ||
      (repaired.startsWith("'") && repaired.endsWith("'"))
    ) {
      try {
        // Try to parse as a JSON string and extract the inner content
        const parsed = JSON.parse(repaired);
        if (typeof parsed === 'string') {
          const innerTrimmed = parsed.trim();
          // If the inner content looks like JSON, use it
          if (
            (innerTrimmed.startsWith('{') && innerTrimmed.endsWith('}')) ||
            (innerTrimmed.startsWith('[') && innerTrimmed.endsWith(']'))
          ) {
            repaired = innerTrimmed;
          }
        }
      } catch {
        // If parsing fails, try to manually unwrap quotes
        if (
          (repaired.startsWith('"') && repaired.endsWith('"')) ||
          (repaired.startsWith("'") && repaired.endsWith("'"))
        ) {
          const unwrapped = repaired.slice(1, -1);
          // Unescape escaped quotes
          const unescaped = unwrapped
            .replaceAll(String.raw`\"`, '"')
            .replaceAll(String.raw`\'`, "'");
          if (
            (unescaped.trimStart().startsWith('{') &&
              unescaped.trimEnd().endsWith('}')) ||
            (unescaped.trimStart().startsWith('[') &&
              unescaped.trimEnd().endsWith(']'))
          ) {
            repaired = unescaped.trim();
          }
        }
      }
    }

    // 1. Extract JSON from markdown code blocks
    const codeBlockMatch = repaired.match(
      /```(?:json|javascript|js)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/i,
    );
    if (codeBlockMatch && codeBlockMatch[1]) {
      repaired = codeBlockMatch[1].trim();
    }

    // 2. Remove JSONP notation like callback({...})
    repaired = repaired.replace(/^\w+\s*\((.*)\)\s*;?$/s, '$1');

    // 3. Replace smart quotes with regular quotes FIRST (only outside strings to preserve content)
    // This must happen before comment removal and Python constant replacement so that string detection works correctly
    repaired = replaceSmartQuotesOutsideStrings(repaired);

    // 4. Remove comments (// and /* */) but preserve them inside strings
    // Remove block comments /* ... */ but only when outside strings
    repaired = removeBlockCommentsOutsideStrings(repaired);

    // For line comments, we need to be more careful to not remove // inside strings
    // Split by lines and process each line
    repaired = repaired
      .split('\n')
      .map((line) => {
        // Walk through the line character by character to find the FIRST // that's OUTSIDE a string
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let escaped = false;
        let commentStart = -1;

        for (let index = 0; index < line.length - 1; index++) {
          const char = line[index];
          const nextChar = line[index + 1];

          if (escaped) {
            // Skip this character, it's escaped
            escaped = false;
            continue;
          }

          if (char === '\\') {
            // Next character will be escaped
            escaped = true;
            continue;
          }

          // Track quote state
          if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
          } else if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
          }

          // Check for // when we're NOT inside a string
          if (
            char === '/' &&
            nextChar === '/' &&
            !inSingleQuote &&
            !inDoubleQuote
          ) {
            commentStart = index;
            break;
          }
        }

        // If we found a comment outside of strings, remove it
        if (commentStart !== -1) {
          return line.slice(0, commentStart).trimEnd();
        }

        return line;
      })
      .join('\n');

    // 5. Replace Python constants (only outside strings to avoid corrupting string values)
    repaired = replacePythonConstantsOutsideStrings(repaired);

    // 6. Fix single quotes to double quotes (for keys and string values)
    // Walk through and convert single-quoted strings to double-quoted
    // This properly handles escaped quotes and doesn't touch single quotes inside double-quoted strings
    let result = '';
    let index = 0;
    let inDoubleQuote = false;
    let escaped = false;

    while (index < repaired.length) {
      const char = repaired[index];

      // Handle escape sequences
      if (escaped) {
        result += '\\' + char;
        escaped = false;
        index++;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        index++;
        continue;
      }

      // Track when we're inside double-quoted strings
      if (char === '"' && !escaped) {
        inDoubleQuote = !inDoubleQuote;
        result += char;
        index++;
        continue;
      }

      // Only convert single quotes when we're NOT inside a double-quoted string
      if (char === "'" && !inDoubleQuote) {
        // Start of single-quoted string - convert to double quotes
        result += '"';
        index++;
        let singleQuoteEscaped = false;
        while (index < repaired.length) {
          const innerChar = repaired[index];

          if (singleQuoteEscaped) {
            // Keep escaped characters, but change \' to just '
            result +=
              innerChar === "'"
                ? "'" // Don't need to escape single quote in double-quoted string
                : '\\' + innerChar;
            singleQuoteEscaped = false;
            index++;
            continue;
          }

          if (innerChar === '\\') {
            singleQuoteEscaped = true;
            index++;
            continue;
          }

          if (innerChar === "'") {
            // End of single-quoted string
            result += '"';
            index++;
            break;
          }

          // Need to escape double quotes when converting from single to double quotes
          result += innerChar === '"' ? String.raw`\"` : innerChar;
          index++;
        }
        continue;
      }

      // Regular character
      result += char;
      index++;
    }
    repaired = result;

    // 7. Fix unquoted keys
    repaired = repaired.replaceAll(
      /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*|\d+)\s*:/g,
      '$1"$2":',
    );

    // 8. Remove trailing commas before closing braces/brackets
    repaired = repaired.replaceAll(/,(\s*[}\]])/g, '$1');

    // 9. Remove leading commas after opening braces/brackets
    repaired = repaired.replaceAll(/([{[]\s*),/g, '$1');

    // 10. Fix special whitespace characters (non-breaking space, etc.)
    repaired = repaired.replaceAll(
      /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g,
      ' ',
    );

    // 11. Handle common ellipsis patterns [...] or {...} that models sometimes add
    repaired = repaired.replaceAll(/,?\s*\.\.\.[\s,]*/g, '');

    // 12. Fix incomplete objects - count and balance braces
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      repaired += '}'.repeat(openBraces - closeBraces);
    }

    // 13. Fix incomplete arrays - count and balance brackets
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      repaired += ']'.repeat(openBrackets - closeBrackets);
    }

    // 14. Validate the repaired JSON
    JSON.parse(repaired);
    return repaired;
  } catch {
    // If enhanced repair fails, try basic extraction
    try {
      // Extract the first valid JSON object or array
      const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        let extracted = jsonMatch[0];

        // Apply basic fixes
        extracted = extracted.replaceAll(/,(\s*[}\]])/g, '$1');
        extracted = extracted.replaceAll("'", '"');
        extracted = extracted.replaceAll(
          /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*|\d+)\s*:/g,
          '$1"$2":',
        );

        // Balance braces
        const openBraces = (extracted.match(/\{/g) || []).length;
        const closeBraces = (extracted.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
          extracted += '}'.repeat(openBraces - closeBraces);
        }

        JSON.parse(extracted);
        return extracted;
      }
    } catch {
      // All repair attempts failed
      return null;
    }
  }

  return null;
}

/** Tries jsonrepair first, then enhancedRepairText for Ollama-specific edge cases. */
export async function cascadeRepairText(options: {
  text: string;
  error: Error;
  schema?: JSONSchema7 | unknown;
}): Promise<string | null> {
  const { text } = options;
  try {
    const repairedText = jsonrepair(text);
    JSON.parse(repairedText);
    return repairedText;
  } catch {
    // pass
  }
  try {
    return await enhancedRepairText(options);
  } catch {
    return null;
  }
}

/**
 * Built-in text repair function for common JSON and Ollama output issues
 */
export async function builtInRepairText(options: {
  text: string;
  error: Error;
  schema?: JSONSchema7 | unknown;
}): Promise<string | null> {
  const { text } = options;
  let repaired = text.trim();

  // Common JSON repair strategies
  try {
    // 1. Try to extract JSON from markdown code blocks
    const codeBlockMatch = repaired.match(
      /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
    );
    if (codeBlockMatch && codeBlockMatch[1]) {
      repaired = codeBlockMatch[1].trim();
    }

    // 2. Remove trailing commas
    repaired = repaired.replaceAll(/,(\s*[}\]])/g, '$1');

    // 3. Fix single quotes to double quotes
    repaired = repaired.replaceAll("'", '"');

    // 4. Fix unquoted keys
    repaired = repaired.replaceAll(/(\w+):/g, '"$1":');

    // 5. Fix incomplete objects - try to close them
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      repaired += '}'.repeat(openBraces - closeBraces);
    }

    // 6. Fix incomplete arrays
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      repaired += ']'.repeat(openBrackets - closeBrackets);
    }

    // 7. Try to parse and validate the repaired JSON
    JSON.parse(repaired);
    return repaired;
  } catch {
    // If repair fails, try more aggressive fixes
    try {
      // 8. Extract the first valid JSON object from the text
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        let extracted = jsonMatch[0];

        // Apply basic fixes to extracted JSON
        extracted = extracted.replaceAll(/,(\s*[}\]])/g, '$1');
        extracted = extracted.replaceAll("'", '"');
        extracted = extracted.replaceAll(/(\w+):/g, '"$1":');

        JSON.parse(extracted);
        return extracted;
      }
    } catch {
      // If all repairs fail, return null to indicate no repair possible
      return null;
    }
  }

  return null;
}

/**
 * Pick the repair function for a call: a caller-supplied one wins, `false`
 * opts out entirely, and otherwise the built-in cascade applies.
 */
export function getRepairFunction(
  options: {
    repairText?: RepairTextFunction;
    enableTextRepair?: boolean;
  } = {},
): RepairTextFunction | undefined {
  // If custom repair function is provided, use it
  if (options.repairText) {
    return options.repairText;
  }

  // If text repair is disabled, return undefined
  if (options.enableTextRepair === false) {
    return undefined;
  }

  return cascadeRepairText;
}

/**
 * Parse JSON with repair functionality
 */
export async function parseJSONWithRepair(
  text: string,
  repairFunction?: RepairTextFunction,
  schema?: JSONSchema7 | unknown,
): Promise<{
  success: boolean;
  data?: unknown;
  error?: Error;
  repaired?: boolean;
}> {
  // First try parsing with safeParseJSON (from AI SDK provider-utils)
  const parseResult = await safeParseJSON({ text });

  if (parseResult.success) {
    // Check if the parsed result is a string that looks like JSON
    // This handles cases where the model returns JSON wrapped in quotes: "{\"key\": \"value\"}"
    if (typeof parseResult.value === 'string') {
      const trimmed = parseResult.value.trim();
      // Check if it looks like JSON (starts with { or [)
      if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        const reparsedResult = await safeParseJSON({ text: trimmed });
        if (reparsedResult.success) {
          return {
            success: true,
            data: reparsedResult.value,
            repaired: true,
          };
        }
      }
    }

    return { success: true, data: parseResult.value };
  }

  // If parsing failed and repair function is provided, try to repair
  if (repairFunction) {
    try {
      const repairedText = await repairFunction({
        text,
        error: parseResult.error,
        schema,
      });

      if (repairedText !== null) {
        const repairedResult = await safeParseJSON({ text: repairedText });

        if (repairedResult.success) {
          // Also check if the repaired data is a string that needs re-parsing
          if (typeof repairedResult.value === 'string') {
            const trimmed = repairedResult.value.trim();
            if (
              (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
              (trimmed.startsWith('[') && trimmed.endsWith(']'))
            ) {
              const reparsedResult = await safeParseJSON({ text: trimmed });
              if (reparsedResult.success) {
                return {
                  success: true,
                  data: reparsedResult.value,
                  repaired: true,
                };
              }
            }
          }

          return {
            success: true,
            data: repairedResult.value,
            repaired: true,
          };
        }

        return {
          success: false,
          error: repairedResult.error,
        };
      }
    } catch (repairError) {
      return { success: false, error: repairError as Error };
    }
  }

  return { success: false, error: parseResult.error };
}
