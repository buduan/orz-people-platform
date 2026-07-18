const SENSITIVE_KEY = /(?:authorization|cookie|password|passkey|secret|token|api[_-]?key|otp|session)/iu;
const REDACTED = '[REDACTED]';

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return '[MAX_DEPTH]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }

  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(item, depth + 1),
    ]),
  );
}
