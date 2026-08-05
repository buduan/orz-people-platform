import type { JsonValue } from '@orz-people-platform/types';

/**
 * 将 JSON 值递归规范化为字符串。
 * 对象 key 按字母序排序，确保相同语义的 JSON 生成相同的字符串表示。
 */
function canonicalize(value: JsonValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JSON numbers must be finite');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => {
    const entryValue = value[key];
    if (entryValue === undefined) {
      throw new TypeError(`Missing JSON value for key "${key}"`);
    }
    return `${JSON.stringify(key)}:${canonicalize(entryValue)}`;
  }).join(',')}}`;
}

/** 返回对象 key 按字母序递归排序后的确定性 JSON 字符串。 */
export function canonicalizeJson(value: JsonValue): string {
  return canonicalize(value);
}

/**
 * 返回规范 JSON 值的小写十六进制 SHA-256 校验和。
 * 用于 Form Schema 内容签名和提交幂等比较。
 */
export async function checksumJson(value: JsonValue): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalizeJson(value)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 创建稳定的不透明 Form item ID。
 * 格式为 q_ + 标准 UUID v4，由 crypto.randomUUID() 生成。
 * 该 ID 不随标题、顺序或 Schema 内容变化而改变。
 */
export function createFormItemId(): string {
  return `q_${globalThis.crypto.randomUUID()}`;
}
