/** A value that can be represented in JSON. */
export type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | JsonObject;

/** A JSON object with recursively JSON-safe values. */
export interface JsonObject {
  [key: string]: JsonValue;
}

/** A JSON Schema object. */
export interface JsonSchemaObject extends JsonObject {}

/** A JSON Schema document. Boolean schemas are valid according to the specification. */
export type JsonSchema = boolean | JsonSchemaObject;
