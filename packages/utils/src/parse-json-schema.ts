/** A value that can be represented in JSON. */
export type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | JsonSchemaObject;

/** A JSON object that can be used as a JSON Schema. */
export interface JsonSchemaObject {
  [keyword: string]: JsonValue;
}

/** A JSON Schema document. Boolean schemas are valid according to the specification. */
export type JsonSchema = boolean | JsonSchemaObject;

/**
 * Parses a JSON Schema document from a JSON string.
 *
 * The JSON Schema specification permits either an object or a boolean at the
 * document root. Other valid JSON values are rejected.
 *
 * @throws {SyntaxError} When the input is not valid JSON or is not a JSON Schema root.
 */
export function parseJsonSchema(source: string): JsonSchema {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'invalid JSON';
    throw new SyntaxError(`Invalid JSON Schema: ${reason}`);
  }

  if (typeof parsed === 'boolean') {
    return parsed;
  }

  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as JsonSchemaObject;
  }

  throw new SyntaxError('Invalid JSON Schema: the root value must be an object or boolean.');
}
