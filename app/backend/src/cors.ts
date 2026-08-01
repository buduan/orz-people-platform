const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

export function isCorsOriginAllowed(
  origin: string | undefined,
  appOrigin: string | undefined,
  isDevelopment: boolean,
): boolean {
  if (!origin) return true;

  try {
    const requestOrigin = new URL(origin);
    if (LOCAL_HOSTNAMES.has(requestOrigin.hostname)) return isDevelopment;
    return appOrigin !== undefined && requestOrigin.origin === new URL(appOrigin).origin;
  } catch {
    return false;
  }
}
