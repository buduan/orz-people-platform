import { normalizeEmail } from '@orz-people-platform/utils';

const maximumUsernameLength = 64;

export function registrationUsernameCandidate(email: string, attempt = 0): string {
  const localPart = normalizeEmail(email).split('@')[0] ?? '';
  let base = localPart
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

  if (!/^[a-z]/.test(base)) base = `u-${base}`;
  if (base.length < 3) base = `${base}-user`;

  const suffix = attempt > 0 ? `-${attempt + 1}` : '';
  const allowedBaseLength = maximumUsernameLength - suffix.length;
  base = base.slice(0, allowedBaseLength).replace(/[-_]+$/g, '');

  return `${base}${suffix}`;
}
