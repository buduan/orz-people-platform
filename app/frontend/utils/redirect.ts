export function resolveSafeRedirect(
  candidate: unknown,
  origin: string,
  fallback = '/dashboard',
): string {
  if (typeof candidate !== 'string'
    || !candidate.startsWith('/')
    || candidate.startsWith('//')
    || candidate.includes('\\')) return fallback;

  try {
    const target = new URL(candidate, origin);
    if (target.origin !== origin
      || target.pathname === '/auth'
      || target.pathname.startsWith('/auth/')) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
