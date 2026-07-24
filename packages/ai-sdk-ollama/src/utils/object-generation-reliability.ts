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
import {
  coerceToSchemaType,
  fixTypeMismatches,
  generateFallbackValues,
  isZodSchema,
} from './json-schema-coercion';
import {
  getRepairFunction,
  parseJSONWithRepair,
  type RepairTextFunction,
} from './json-text-repair';

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
   * Custom repair function for malformed JSON or validation errors.
   * If provided, replaces the default cascade (jsonrepair then enhancedRepairText).
   */
  repairText?: RepairTextFunction;

  /**
   * Whether to enable automatic JSON repair for malformed LLM outputs.
   * Default: true. Uses jsonrepair then enhancedRepairText for edge cases.
   * Set to false to disable.
   */
  enableTextRepair?: boolean;
}

export interface ReliableObjectGenerationResult<T> {
  object: T;
  success: boolean;
  retryCount: number;
  errors?: string[];
  recoveryMethod?:
    'retry' | 'fallback' | 'type_fix' | 'text_repair' | 'natural';
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

      const jsonSchema = schema as JSONSchema7;
      if (jsonSchema.type) {
        const expectedType = jsonSchema.type;
        const actualType = Array.isArray(recoveredObject)
          ? 'array'
          : recoveredObject === null
            ? 'null'
            : typeof recoveredObject;

        if (Array.isArray(expectedType)) {
          const typeMatches = expectedType.some((allowedType) => {
            if (allowedType === 'array') return Array.isArray(recoveredObject);
            if (allowedType === 'object') {
              return (
                typeof recoveredObject === 'object' &&
                recoveredObject !== null &&
                !Array.isArray(recoveredObject)
              );
            }
            if (allowedType === 'null') return recoveredObject === null;
            return actualType === allowedType;
          });

          if (!typeMatches) {
            throw new Error(
              `Recovery produced ${actualType}, but schema expects one of [${expectedType.join(', ')}]`,
              { cause: error },
            );
          }
        } else {
          if (expectedType === 'array' && !Array.isArray(recoveredObject)) {
            throw new Error(
              `Recovery produced ${actualType}, but schema expects array`,
              { cause: error },
            );
          }

          if (
            expectedType === 'object' &&
            (typeof recoveredObject !== 'object' ||
              recoveredObject === null ||
              Array.isArray(recoveredObject))
          ) {
            throw new Error(
              `Recovery produced ${actualType}, but schema expects object`,
              { cause: error },
            );
          }

          if (expectedType === 'null' && recoveredObject !== null) {
            throw new Error(
              `Recovery produced ${actualType}, but schema expects null`,
              { cause: error },
            );
          }

          if (
            typeof expectedType === 'string' &&
            expectedType !== 'object' &&
            expectedType !== 'array' &&
            expectedType !== 'null' &&
            actualType !== expectedType
          ) {
            throw new Error(
              `Recovery produced ${actualType}, but schema expects ${expectedType}`,
              { cause: error },
            );
          }
        }
      }

      return { success: true, object: recoveredObject, repaired: wasRepaired };
    } catch (recoveryError) {
      // If recovery fails, try using fallback values
      if (options.useFallbacks) {
        try {
          const fallbacks = generateFallbackValues(schema);
          const merged =
            typeof parsedObject === 'object' &&
            parsedObject !== null &&
            !Array.isArray(parsedObject)
              ? {
                  ...fallbacks,
                  ...(parsedObject as Record<string, unknown>),
                }
              : fallbacks;

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
  generateObjectFunction: (
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
        const result = await generateObjectFunction(generationOptions);

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
  generateObjectFunction: (
    options: Record<string, unknown>,
  ) => Promise<{ object: T }>,
  options: Record<string, unknown>,
  schema: JSONSchema7 | unknown,
  reliabilityOptions: ObjectGenerationOptions = {},
): Promise<ReliableObjectGenerationResult<T>> {
  const reliableGenerator = createReliableObjectGeneration(
    generateObjectFunction,
    schema,
    reliabilityOptions,
  );
  return await reliableGenerator(options);
}
