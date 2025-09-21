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
   */
  repairText?: RepairTextFunction;

  /**
   * Whether to enable built-in text repair for common JSON issues
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
  enableTextRepair: true,
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
  // First try normal parsing
  try {
    const parsed = JSON.parse(text);
    return { success: true, data: parsed };
  } catch (originalError) {
    // If repair function is provided, try to repair
    if (repairFunction) {
      try {
        const repairedText = await repairFunction({
          text,
          error: originalError as Error,
          schema,
        });

        if (repairedText !== null) {
          const repairedData = JSON.parse(repairedText);
          return { success: true, data: repairedData, repaired: true };
        }
      } catch (repairError) {
        return { success: false, error: repairError as Error };
      }
    }

    return { success: false, error: originalError as Error };
  }
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
    const repairFunction =
      options.repairText ||
      (options.enableTextRepair ? builtInRepairText : undefined);
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

  try {
    // Try to validate with the appropriate schema
    if (isZodSchema(schema)) {
      const result = schema.safeParse(parsedObject);
      if (result.success) {
        return { success: true, object: result.data, repaired: wasRepaired };
      }
      throw new Error('Zod validation failed');
    } else {
      // Basic validation for JSONSchema7 - check if the object has required structure
      if (typeof parsedObject === 'object' && parsedObject !== null) {
        return { success: true, object: parsedObject, repaired: wasRepaired };
      }
      throw new Error('Invalid object structure');
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
