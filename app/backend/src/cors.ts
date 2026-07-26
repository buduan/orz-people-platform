import { isIP } from 'node:net';

function isLocalHostname(hostname: string): boolean {
  const value = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    value === 'localhost'
    || value === 'localhost.localdomain'
    || value.endsWith('.localhost')
  ) return true;

  if (isIP(value) === 4) {
    const [first, second] = value.split('.').map(Number);
    return first === 0
      || first === 10
      || first === 127
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168);
  }

  return isIP(value) === 6 && (
    value === '::1'
    || value.startsWith('fc')
    || value.startsWith('fd')
    || /^fe[89ab]/.test(value)
  );
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  appOrigin: string | undefined,
  allowLocalOrigins: boolean,
): boolean {
  if (!origin) return true;

  try {
    if (appOrigin && new URL(origin).origin === new URL(appOrigin).origin) return true;
    return allowLocalOrigins && isLocalHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}
