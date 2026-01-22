/**
 * Object Generation Reliability Utilities for Ollama
 *
 * This module provides utilities to make Ollama object generation more reliable
 * and deterministic. It addresses common issues like:
 * - Schema validation failures
 * - Inconsistent results across multiple attempts
 * - Timeout and fetch errors
 * - Malformed JSON responses
 * - Type mismatches (strings vs numbers)
 */

import type { JSONSchema7 } from '@ai-sdk/provider';
import { safeParseJSON } from '@ai-sdk/provider-utils';

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

// Basic Zod type interfaces to avoid dependency
interface ZodSchema {
  parse(data: unknown): unknown;
  safeParse(data: unknown): {
    success: boolean;
    data?: unknown;
    error?: unknown;
  };
}

interface ZodObject extends ZodSchema {
  shape: Record<string, ZodSchema>;
}

// Helper to check if something is a Zod schema
function isZodSchema(schema: unknown): schema is ZodSchema {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    'parse' in schema &&
    typeof (schema as ZodSchema).parse === 'function'
  );
}

function isZodObject(schema: unknown): schema is ZodObject {
  return (
    isZodSchema(schema) &&
    'shape' in schema &&
    typeof (schema as ZodObject).shape === 'object'
  );
}

export interface ObjectGenerationOptions {
  /**
   * Maximum number of retry attempts for object generation
   */
  maxRetries?: number;

  /**
   * Whether to attempt schema recovery when validation fails
   */
  attemptRecovery?: boolean;

  /**
   * Whether to use fallback values for failed generations
   */
  useFallbacks?: boolean;

  /**
   * Custom fallback values for specific fields
   */
  fallbackValues?: Record<string, unknown>;

  /**
   * Timeout for object generation in milliseconds
   */
  generationTimeout?: number;

  /**
   * Whether to validate and fix type mismatches
   */
  fixTypeMismatches?: boolean;

  /**
   * Custom repair function for malformed JSON or validation errors
   * If provided, this will be used instead of the default jsonrepair
   */
  repairText?: RepairTextFunction;

  /**
   * Whether to enable automatic JSON repair for malformed LLM outputs
   * Default: true (enabled by default for better reliability)
   * Handles 14+ types of JSON issues including Python constants, JSONP, comments,
   * escaped quotes, URLs in strings, trailing commas, unquoted keys, etc.
   * Set to false to disable all automatic repair
   */
  enableTextRepair?: boolean;
}

export interface ReliableObjectGenerationResult<T> {
  object: T;
  success: boolean;
  retryCount: number;
  errors?: string[];
  recoveryMethod?:
    | 'retry'
    | 'fallback'
    | 'type_fix'
    | 'text_repair'
    | 'natural';
}

const DEFAULT_OBJECT_GENERATION_OPTIONS: Required<
  Pick<
    ObjectGenerationOptions,
    | 'maxRetries'
    | 'attemptRecovery'
    | 'useFallbacks'
    | 'fixTypeMismatches'
    | 'enableTextRepair'
  >
> = {
  maxRetries: 3,
  attemptRecovery: true,
  useFallbacks: true,
  fixTypeMismatches: true,
  enableTextRepair: true, // Enabled by default
};

export function resolveObjectGenerationOptions(
  options?: ObjectGenerationOptions,
): ObjectGenerationOptions & typeof DEFAULT_OBJECT_GENERATION_OPTIONS {
  return {
    ...DEFAULT_OBJECT_GENERATION_OPTIONS,
    ...options,
  };
}

/**
 * Generate fallback values for a JSON schema or Zod schema
 */
export function generateFallbackValues(
  schema: JSONSchema7 | unknown,
): Record<string, unknown> {
  const fallbacks: Record<string, unknown> = {};

  // Handle Zod schema
  if (isZodObject(schema)) {
    const shape = schema.shape;
    for (const [key, fieldSchema] of Object.entries(shape)) {
      fallbacks[key] = generateBasicFallbackFromZod(fieldSchema);
    }
    return fallbacks;
  }

  // Handle JSONSchema7
  if (
    typeof schema === 'object' &&
    schema !== null &&
    'type' in schema &&
    (schema as JSONSchema7).type === 'object' &&
    'properties' in schema &&
    (schema as JSONSchema7).properties
  ) {
    const jsonSchema = schema as JSONSchema7;
    const properties = jsonSchema.properties;
    if (properties && typeof properties === 'object') {
      for (const [key, fieldSchema] of Object.entries(properties)) {
        fallbacks[key] = generateFallbackValueFromJsonSchema(
          fieldSchema as JSONSchema7,
        );
      }
    }
  }

  return fallbacks;
}

/**
 * Generate a fallback value for a JSONSchema7
 */
function generateFallbackValueFromJsonSchema(schema: JSONSchema7): unknown {
  if (schema.type === 'string') {
    if (schema.format === 'email') {
      return 'user@example.com';
    }
    return '';
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return 0;
  }

  if (schema.type === 'boolean') {
    return false;
  }

  if (schema.type === 'array') {
    return [];
  }

  if (schema.type === 'object' && schema.properties) {
    const fallbacks: Record<string, unknown> = {};
    for (const [key, fieldSchema] of Object.entries(schema.properties)) {
      fallbacks[key] = generateFallbackValueFromJsonSchema(
        fieldSchema as JSONSchema7,
      );
    }
    return fallbacks;
  }

  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  return null;
}

/**
 * Generate basic fallback values for Zod schemas without full type introspection
 */
function generateBasicFallbackFromZod(schema: ZodSchema): unknown {
  // Try to safely parse some basic fallback values to determine type
  const testValues = [
    '', // string
    0, // number
    false, // boolean
    [], // array
    {}, // object
  ];

  for (const testValue of testValues) {
    const result = schema.safeParse(testValue);
    if (result.success) {
      return testValue;
    }
  }

  // If none work, try null or return a basic object
  const nullResult = schema.safeParse(null);
  if (nullResult.success) {
    return null;
  }

  // Default fallback - try empty object for complex types
  const objResult = schema.safeParse({});
  if (objResult.success) {
    return {};
  }

  return null;
}

/**
 * Attempt basic type coercion for Zod schemas
 */
function attemptZodTypeCoercion(value: unknown, schema: ZodSchema): unknown {
  // Try the original value first
  const originalResult = schema.safeParse(value);
  if (originalResult.success) {
    return originalResult.data;
  }

  // If value is object and schema expects object, handle recursively
  if (typeof value === 'object' && value !== null && isZodObject(schema)) {
    try {
      const fixed = fixTypeMismatches(value as Record<string, unknown>, schema);
      const recursiveResult = schema.safeParse(fixed);
      if (recursiveResult.success) {
        return recursiveResult.data;
      }
    } catch {
      // If recursive fixing fails, continue with other coercion attempts
    }
  }

  // Try type coercion
  if (typeof value === 'string') {
    // Try number
    const asNumber = Number.parseFloat(value);
    if (!Number.isNaN(asNumber)) {
      const numberResult = schema.safeParse(asNumber);
      if (numberResult.success) {
        return numberResult.data;
      }
    }

    // Try boolean
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === 'false') {
      const boolResult = schema.safeParse(lowerValue === 'true');
      if (boolResult.success) {
        return boolResult.data;
      }
    }
  }

  // Try fallback values
  const fallbacks = ['', 0, false, [], {}];
  for (const fallback of fallbacks) {
    const result = schema.safeParse(fallback);
    if (result.success) {
      return result.data;
    }
  }

  return value; // Return original if nothing works
}

/**
 * Attempt to fix type mismatches in generated objects
 */
export function fixTypeMismatches(
  object: Record<string, unknown>,
  schema: JSONSchema7 | unknown,
): Record<string, unknown> {
  const fixed: Record<string, unknown> = {};

  // Handle Zod schema - use basic type coercion
  if (isZodObject(schema)) {
    const shape = schema.shape;
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const value = object[key];
      fixed[key] = attemptZodTypeCoercion(value, fieldSchema);
    }
    return fixed;
  }

  // Handle JSONSchema7
  if (
    typeof schema === 'object' &&
    schema !== null &&
    'type' in schema &&
    (schema as JSONSchema7).type === 'object' &&
    'properties' in schema
  ) {
    const jsonSchema = schema as JSONSchema7;
    if (jsonSchema.properties) {
      for (const [key, fieldSchema] of Object.entries(jsonSchema.properties)) {
        const value = object[key];
        const field = fieldSchema as JSONSchema7;

        switch (field.type) {
          case 'string': {
            fixed[key] = String(value ?? '');

            break;
          }
          case 'number':
          case 'integer': {
            if (typeof value === 'string') {
              const parsed = Number.parseFloat(value);
              fixed[key] = Number.isNaN(parsed) ? 0 : parsed;
            } else if (typeof value === 'number') {
              fixed[key] = value;
            } else {
              fixed[key] = 0;
            }

            break;
          }
          case 'boolean': {
            if (typeof value === 'boolean') {
              fixed[key] = value;
            } else if (typeof value === 'string') {
              fixed[key] = value.toLowerCase() === 'true';
            } else {
              fixed[key] = Boolean(value);
            }

            break;
          }
          case 'array': {
            fixed[key] = Array.isArray(value) ? value : [];

            break;
          }
          default: {
            if (field.type === 'object' && field.properties) {
              fixed[key] =
                typeof value === 'object' && value !== null
                  ? fixTypeMismatches(value as Record<string, unknown>, field)
                  : generateFallbackValues(field);
            } else if (field.enum && Array.isArray(field.enum)) {
              fixed[key] = field.enum.includes(value as string)
                ? value
                : field.enum[0];
            } else {
              fixed[key] = value;
            }
          }
        }
      }
    }
  }

  return fixed;
}

/**
 * Remove block comments (slash-star ... star-slash) but only when outside strings
 */
function removeBlockCommentsOutsideStrings(text: string): string {
  let result = '';
  let i = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (escaped) {
      result += char;
      escaped = false;
      i++;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      i++;
      continue;
    }

    // Track quote state
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      result += char;
      i++;
      continue;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += char;
      i++;
      continue;
    }

    // Check for block comment start /* when NOT inside a string
    if (char === '/' && nextChar === '*' && !inSingleQuote && !inDoubleQuote) {
      // Skip until we find */
      i += 2; // Skip /*
      while (i < text.length - 1) {
        if (text[i] === '*' && text[i + 1] === '/') {
          i += 2; // Skip */
          break;
        }
        i++;
      }
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

/**
 * Replace Python constants (None, True, False) but only when outside strings
 */
function replacePythonConstantsOutsideStrings(text: string): string {
  let result = '';
  let i = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  while (i < text.length) {
    const char = text[i];

    if (escaped) {
      result += char;
      escaped = false;
      i++;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      i++;
      continue;
    }

    // Track quote state
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      result += char;
      i++;
      continue;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += char;
      i++;
      continue;
    }

    // Only process replacements when NOT inside a string
    if (!inSingleQuote && !inDoubleQuote) {
      // Check for Python constants with word boundaries
      const remaining = text.slice(i);
      const noneRegex = /^\bNone\b/;
      const trueRegex = /^\bTrue\b/;
      const falseRegex = /^\bFalse\b/;

      if (noneRegex.test(remaining)) {
        result += 'null';
        i += 4; // Skip "None"
        continue;
      } else if (trueRegex.test(remaining)) {
        result += 'true';
        i += 4; // Skip "True"
        continue;
      } else if (falseRegex.test(remaining)) {
        result += 'false';
        i += 5; // Skip "False"
        continue;
      }
    }

    result += char;
    i++;
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
  let i = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inSmartDoubleQuote = false; // Track smart double quotes (\u201C and \u201D)
  let escaped = false;

  while (i < text.length) {
    const char = text[i];

    if (escaped) {
      result += char;
      escaped = false;
      i++;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      i++;
      continue;
    }

    // Track quote state - including smart quotes as delimiters
    if (char === "'" && !inDoubleQuote && !inSmartDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      result += char;
      i++;
      continue;
    } else if (char === '"' && !inSingleQuote && !inSmartDoubleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += char;
      i++;
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
      i++;
      continue;
    } else if (char === '\u201D' && inSmartDoubleQuote) {
      // Check if this is the closing quote by looking ahead
      // If we're inside a smart-quoted string and see \u201D, we need to determine
      // if it's closing the current string or if it's an inner quote.
      // We'll use a heuristic: if we're at end-of-text OR the next non-whitespace
      // character is a structural character that cannot be inside a string value.
      let isClosing = false;
      let j = i + 1;

      // Skip whitespace
      while (j < text.length) {
        const nextChar = text[j];
        if (nextChar === ' ' || nextChar === '\t' || nextChar === '\n') {
          j++;
          continue;
        }

        // Check for } or ] - these are structural characters that cannot be inside strings
        if (nextChar === '}' || nextChar === ']') {
          isClosing = true;
          break;
        }

        // Check for , - this can be inside strings OR a field separator
        // If , is followed by whitespace and then a new key (starts with " or smart quote), it's likely closing a value
        if (nextChar === ',') {
          let k = j + 1;
          // Skip whitespace after comma
          while (k < text.length) {
            const afterComma = text[k];
            if (!afterComma) {
              break;
            }
            if (
              afterComma === ' ' ||
              afterComma === '\t' ||
              afterComma === '\n'
            ) {
              k++;
              continue;
            }
            // If comma is followed by a key-starting character, it's likely a field separator
            // Key-starting chars: quote, smart quote, unquoted key (letter, underscore, dollar), or numeric key (digit followed by colon)
            if (
              afterComma === '"' ||
              afterComma === '\u201C' ||
              (afterComma >= 'a' && afterComma <= 'z') ||
              (afterComma >= 'A' && afterComma <= 'Z') ||
              afterComma === '_' ||
              afterComma === '$'
            ) {
              isClosing = true;
              break; // Found key-starting character, exit comma check loop
            } else if (afterComma >= '0' && afterComma <= '9') {
              // Check if digit is followed by colon (numeric key like "2: value")
              let m = k + 1;
              while (m < text.length) {
                const afterDigit = text[m];
                if (
                  afterDigit === ' ' ||
                  afterDigit === '\t' ||
                  afterDigit === '\n'
                ) {
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
          let k = j + 1;
          // Skip whitespace after colon
          while (k < text.length) {
            const afterColon = text[k];
            if (!afterColon) {
              break;
            }
            if (
              afterColon === ' ' ||
              afterColon === '\t' ||
              afterColon === '\n'
            ) {
              k++;
              continue;
            }
            // If colon is followed by a value-starting character, it's likely a key-value separator
            // Value-starting chars: ", {, [, digit, -, t/T (true/True), f/F (false/False), n/N (null/None), smart quotes
            if (
              afterColon === '"' ||
              afterColon === '\u201C' || // Opening smart quote
              afterColon === '{' ||
              afterColon === '[' ||
              (afterColon >= '0' && afterColon <= '9') ||
              afterColon === '-' ||
              afterColon === 't' ||
              afterColon === 'T' ||
              afterColon === 'f' ||
              afterColon === 'F' ||
              afterColon === 'n' ||
              afterColon === 'N'
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
      if (j >= text.length) {
        isClosing = true;
      }

      if (isClosing) {
        // Closing smart double quote (\u201D) - end of smart-quoted string
        inSmartDoubleQuote = false;
        result += '"'; // Convert to regular quote
        i++;
        continue;
      }
      // Otherwise, it's an inner smart quote - preserve it
    }

    // Only replace smart quotes when NOT inside any string
    if (!inSingleQuote && !inDoubleQuote && !inSmartDoubleQuote) {
      // Replace smart single quotes
      if (
        char === '\u2018' ||
        char === '\u2019' ||
        char === '\u0060' ||
        char === '\u00B4'
      ) {
        result += "'";
        i++;
        continue;
      }
      // Replace smart double quotes when not used as delimiters
      if (char === '\u201C' || char === '\u201D') {
        result += '"';
        i++;
        continue;
      }
    }

    // Inside strings (including smart-quoted strings), preserve all characters
    result += char;
    i++;
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
            (unescaped.trim().startsWith('{') &&
              unescaped.trim().endsWith('}')) ||
            (unescaped.trim().startsWith('[') && unescaped.trim().endsWith(']'))
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

        for (let i = 0; i < line.length - 1; i++) {
          const char = line[i];
          const nextChar = line[i + 1];

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
            commentStart = i;
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
    let i = 0;
    let inDoubleQuote = false;
    let escaped = false;

    while (i < repaired.length) {
      const char = repaired[i];

      // Handle escape sequences
      if (escaped) {
        result += '\\' + char;
        escaped = false;
        i++;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        i++;
        continue;
      }

      // Track when we're inside double-quoted strings
      if (char === '"' && !escaped) {
        inDoubleQuote = !inDoubleQuote;
        result += char;
        i++;
        continue;
      }

      // Only convert single quotes when we're NOT inside a double-quoted string
      if (char === "'" && !inDoubleQuote) {
        // Start of single-quoted string - convert to double quotes
        result += '"';
        i++;
        let singleQuoteEscaped = false;
        while (i < repaired.length) {
          const innerChar = repaired[i];

          if (singleQuoteEscaped) {
            // Keep escaped characters, but change \' to just '
            result +=
              innerChar === "'"
                ? "'" // Don't need to escape single quote in double-quoted string
                : '\\' + innerChar;
            singleQuoteEscaped = false;
            i++;
            continue;
          }

          if (innerChar === '\\') {
            singleQuoteEscaped = true;
            i++;
            continue;
          }

          if (innerChar === "'") {
            // End of single-quoted string
            result += '"';
            i++;
            break;
          }

          // Need to escape double quotes when converting from single to double quotes
          result += innerChar === '"' ? String.raw`\"` : innerChar;
          i++;
        }
        continue;
      }

      // Regular character
      result += char;
      i++;
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
 * Get the appropriate repair function based on options
 */
export function getRepairFunction(
  options: ObjectGenerationOptions = {},
): RepairTextFunction | undefined {
  // If custom repair function is provided, use it
  if (options.repairText) {
    return options.repairText;
  }

  // If text repair is disabled, return undefined
  if (options.enableTextRepair === false) {
    return undefined;
  }

  // Use enhanced repair by default
  return enhancedRepairText;
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

/**
 * Attempt to coerce the parsed object to match the expected schema type.
 * This handles cases where Ollama returns:
 * - An array when an object is expected
 * - A raw array when {elements: [...]} wrapper is expected
 * - An object when an array is expected
 */
function coerceToSchemaType(
  parsedObject: unknown,
  schema: JSONSchema7 | unknown,
): { coerced: unknown; wasCoerced: boolean } {
  if (typeof schema !== 'object' || schema === null) {
    return { coerced: parsedObject, wasCoerced: false };
  }

  const jsonSchema = schema as JSONSchema7;

  // Case 1: Schema expects object with "elements" array property (AI SDK array output pattern)
  // but model returned a raw array
  if (
    jsonSchema.type === 'object' &&
    jsonSchema.properties &&
    'elements' in jsonSchema.properties &&
    Array.isArray(parsedObject)
  ) {
    return {
      coerced: { elements: parsedObject },
      wasCoerced: true,
    };
  }

  // Case 2: Schema expects an object but got an array
  // Try to extract first element if it's a single-element array containing an object
  if (
    jsonSchema.type === 'object' &&
    Array.isArray(parsedObject) &&
    parsedObject.length === 1 &&
    typeof parsedObject[0] === 'object' &&
    parsedObject[0] !== null &&
    !Array.isArray(parsedObject[0])
  ) {
    return {
      coerced: parsedObject[0],
      wasCoerced: true,
    };
  }

  // Case 3: Schema expects an array but got an object
  // Check if the object has properties that look like array items
  if (
    jsonSchema.type === 'array' &&
    typeof parsedObject === 'object' &&
    parsedObject !== null &&
    !Array.isArray(parsedObject)
  ) {
    const obj = parsedObject as Record<string, unknown>;

    // If object has an "elements" property that's an array, extract it
    if (Array.isArray(obj.elements)) {
      return {
        coerced: obj.elements,
        wasCoerced: true,
      };
    }

    // If object has a "data" or "items" property that's an array, extract it
    if (Array.isArray(obj.data)) {
      return {
        coerced: obj.data,
        wasCoerced: true,
      };
    }
    if (Array.isArray(obj.items)) {
      return {
        coerced: obj.items,
        wasCoerced: true,
      };
    }

    // If the object has numeric keys (0, 1, 2...), convert to array
    const keys = Object.keys(obj);
    if (keys.every((k) => /^\d+$/.test(k))) {
      const maxIndex = Math.max(...keys.map(Number));
      const arr: unknown[] = [];
      for (let i = 0; i <= maxIndex; i++) {
        arr.push(obj[String(i)]);
      }
      return {
        coerced: arr,
        wasCoerced: true,
      };
    }

    // Last resort: wrap the single object in an array
    return {
      coerced: [parsedObject],
      wasCoerced: true,
    };
  }

  return { coerced: parsedObject, wasCoerced: false };
}

/**
 * Validate and attempt to recover from schema validation failures
 */
export async function attemptSchemaRecovery(
  rawObject: unknown,
  schema: JSONSchema7 | unknown,
  options: ObjectGenerationOptions = {},
): Promise<{
  success: boolean;
  object?: unknown;
  error?: string;
  repaired?: boolean;
}> {
  // First, try to parse the raw object with repair if it's a string
  let parsedObject: unknown;
  let wasRepaired = false;

  if (typeof rawObject === 'string') {
    const repairFunction = getRepairFunction(options);
    const parseResult = await parseJSONWithRepair(
      rawObject,
      repairFunction,
      schema,
    );

    if (!parseResult.success) {
      return { success: false, error: 'Invalid JSON string - repair failed' };
    }

    parsedObject = parseResult.data;
    wasRepaired = parseResult.repaired || false;
  } else {
    parsedObject = rawObject;
  }

  // Attempt to coerce the parsed object to match the schema type
  const { coerced, wasCoerced } = coerceToSchemaType(parsedObject, schema);
  parsedObject = coerced;
  if (wasCoerced) {
    wasRepaired = true;
  }

  try {
    // Try to validate with the appropriate schema
    if (isZodSchema(schema)) {
      const result = schema.safeParse(parsedObject);
      if (result.success) {
        return { success: true, object: result.data, repaired: wasRepaired };
      }
      throw new Error('Zod validation failed');
    } else {
      // Basic validation for JSONSchema7
      // Handle both object and non-object schemas (string, number, array, etc.)
      const jsonSchema = schema as JSONSchema7;

      // If schema specifies a type, validate against it
      if (jsonSchema.type) {
        const expectedType = jsonSchema.type;
        const actualType = Array.isArray(parsedObject)
          ? 'array'
          : parsedObject === null
            ? 'null'
            : typeof parsedObject;

        // Handle union types (type is an array of allowed types)
        if (Array.isArray(expectedType)) {
          // Check if actual type matches any of the allowed types
          const typeMatches = expectedType.some((allowedType) => {
            if (allowedType === 'array') {
              return Array.isArray(parsedObject);
            }
            if (allowedType === 'object') {
              return (
                typeof parsedObject === 'object' &&
                parsedObject !== null &&
                !Array.isArray(parsedObject)
              );
            }
            if (allowedType === 'null') {
              return parsedObject === null;
            }
            return actualType === allowedType;
          });

          if (!typeMatches) {
            throw new Error(
              `Expected one of [${expectedType.join(', ')}], got ${actualType}`,
            );
          }
        } else {
          // Single type validation
          // For array type, check if it's an array
          if (expectedType === 'array' && !Array.isArray(parsedObject)) {
            throw new Error('Expected array type');
          }

          // For object type, check if it's an object (but not null or array)
          if (
            expectedType === 'object' &&
            (typeof parsedObject !== 'object' ||
              parsedObject === null ||
              Array.isArray(parsedObject))
          ) {
            throw new Error('Expected object type');
          }

          // For null type
          if (expectedType === 'null' && parsedObject !== null) {
            throw new Error('Expected null type');
          }

          // For primitive types, validate the type matches
          if (
            typeof expectedType === 'string' &&
            expectedType !== 'object' &&
            expectedType !== 'array' &&
            expectedType !== 'null' &&
            actualType !== expectedType
          ) {
            throw new Error(`Expected ${expectedType} type, got ${actualType}`);
          }
        }
      }

      // If no type specified or type check passed, return the parsed object
      return { success: true, object: parsedObject, repaired: wasRepaired };
    }
  } catch (error) {
    if (!options.attemptRecovery) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        repaired: wasRepaired,
      };
    }

    // Attempt recovery
    try {
      let recoveredObject = parsedObject;

      // Try to fix type mismatches
      if (
        options.fixTypeMismatches &&
        typeof parsedObject === 'object' &&
        parsedObject !== null
      ) {
        recoveredObject = fixTypeMismatches(
          parsedObject as Record<string, unknown>,
          schema,
        );
      }

      return { success: true, object: recoveredObject, repaired: wasRepaired };
    } catch (recoveryError) {
      // If recovery fails, try using fallback values
      if (options.useFallbacks) {
        try {
          const fallbacks = generateFallbackValues(schema);
          const merged = {
            ...fallbacks,
            ...(parsedObject as Record<string, unknown>),
          };
          return { success: true, object: merged, repaired: wasRepaired };
        } catch {
          return {
            success: false,
            error: `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
            repaired: wasRepaired,
          };
        }
      }

      return {
        success: false,
        error: `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
        repaired: wasRepaired,
      };
    }
  }
}

/**
 * Create a reliable object generation wrapper
 */
export function createReliableObjectGeneration<T>(
  generateObjectFn: (
    options: Record<string, unknown>,
  ) => Promise<{ object: T }>,
  schema: JSONSchema7 | unknown,
  options: ObjectGenerationOptions = {},
) {
  const resolvedOptions = resolveObjectGenerationOptions(options);

  return async (
    generationOptions: Record<string, unknown>,
  ): Promise<ReliableObjectGenerationResult<T>> => {
    const errors: string[] = [];

    for (let attempt = 1; attempt <= resolvedOptions.maxRetries; attempt++) {
      try {
        const result = await generateObjectFn(generationOptions);

        // Try to validate the result
        const validation = await attemptSchemaRecovery(
          result.object,
          schema,
          resolvedOptions,
        );

        if (validation.success) {
          return {
            object: validation.object as T,
            success: true,
            retryCount: attempt,
            recoveryMethod: validation.repaired
              ? 'text_repair'
              : attempt > 1
                ? 'retry'
                : 'natural',
            errors: errors.length > 0 ? errors : undefined,
          };
        } else {
          errors.push(`Attempt ${attempt}: ${validation.error}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push(`Attempt ${attempt}: ${errorMessage}`);

        // If this is the last attempt, try fallback values
        if (
          attempt === resolvedOptions.maxRetries &&
          resolvedOptions.useFallbacks
        ) {
          try {
            const fallbacks = generateFallbackValues(schema);

            return {
              object: fallbacks as T,
              success: true,
              retryCount: attempt,
              recoveryMethod: 'fallback',
              errors,
            };
          } catch (fallbackError) {
            // Fallback also failed
            errors.push(
              `Fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
            );
          }
        }
      }
    }

    // All attempts failed
    throw new Error(
      `Object generation failed after ${resolvedOptions.maxRetries} attempts. Errors: ${errors.join(', ')}`,
    );
  };
}

/**
 * Enhanced object generation with reliability features
 */
export async function reliableGenerateObject<T>(
  generateObjectFn: (
    options: Record<string, unknown>,
  ) => Promise<{ object: T }>,
  options: Record<string, unknown>,
  schema: JSONSchema7 | unknown,
  reliabilityOptions: ObjectGenerationOptions = {},
): Promise<ReliableObjectGenerationResult<T>> {
  const reliableGenerator = createReliableObjectGeneration(
    generateObjectFn,
    schema,
    reliabilityOptions,
  );
  return await reliableGenerator(options);
}
