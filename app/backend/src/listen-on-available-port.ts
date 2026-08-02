type Listen = (port: number) => Promise<unknown>;

function isAddressInUseError(error: unknown): boolean {
  return error instanceof Error
    && 'code' in error
    && error.code === 'EADDRINUSE';
}

export async function listenOnAvailablePort(
  listen: Listen,
  port: number,
  retryOnAddressInUse: boolean,
): Promise<number> {
  try {
    await listen(port);
    return port;
  } catch (error: unknown) {
    if (!retryOnAddressInUse || !isAddressInUseError(error)) throw error;

    return listenOnAvailablePort(listen, port + 2, retryOnAddressInUse);
  }
}
