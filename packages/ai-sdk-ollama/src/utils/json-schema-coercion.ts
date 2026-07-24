/**
 * Reconciling a model's output with the schema it was asked for.
 *
 * Two jobs: invent a value that satisfies a schema when generation fails
 * outright, and coerce near-misses (a number sent as a string, a scalar sent
 * where an array was asked for) into the shape the schema wants.
 */

import type { JSONSchema7 } from '@ai-sdk/provider';

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
export function isZodSchema(schema: unknown): schema is ZodSchema {
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
  const objectResult = schema.safeParse({});
  if (objectResult.success) {
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
 * Attempt to coerce the parsed object to match the expected schema type.
 * This handles cases where Ollama returns:
 * - An array when an object is expected
 * - A raw array when {elements: [...]} wrapper is expected
 * - An object when an array is expected
 */
export function coerceToSchemaType(
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
    const object = parsedObject as Record<string, unknown>;

    // If object has an "elements" property that's an array, extract it
    if (Array.isArray(object.elements)) {
      return {
        coerced: object.elements,
        wasCoerced: true,
      };
    }

    // If object has a "data" or "items" property that's an array, extract it
    if (Array.isArray(object.data)) {
      return {
        coerced: object.data,
        wasCoerced: true,
      };
    }
    if (Array.isArray(object.items)) {
      return {
        coerced: object.items,
        wasCoerced: true,
      };
    }

    // If the object has numeric keys (0, 1, 2...), convert to array
    const keys = Object.keys(object);
    if (keys.every((k) => /^\d+$/.test(k))) {
      const maxIndex = Math.max(...keys.map(Number));
      const array: unknown[] = [];
      for (let index = 0; index <= maxIndex; index++) {
        array.push(object[String(index)]);
      }
      return {
        coerced: array,
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
