export interface PasswordPolicyResult {
  valid: boolean;
  categories: number;
  reason?: 'characters' | 'length' | 'categories';
}

const visibleAsciiPattern = /^[\x21-\x7e]+$/;

export function validatePassword(password: string): PasswordPolicyResult {
  if (password.length < 9 || password.length > 128) {
    return { valid: false, categories: 0, reason: 'length' };
  }

  if (!visibleAsciiPattern.test(password)) {
    return { valid: false, categories: 0, reason: 'characters' };
  }

  const categories = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z\d]/]
    .filter((pattern) => pattern.test(password)).length;

  return categories >= 3
    ? { valid: true, categories }
    : { valid: false, categories, reason: 'categories' };
}
