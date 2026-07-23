import { passkeyClient } from '@better-auth/passkey/client';
import { adminClient, emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/vue';

export function createAppAuthClient() {
  return createAuthClient({
    basePath: '/api/auth',
    plugins: [emailOTPClient(), passkeyClient(), adminClient()],
  });
}

export type AppAuthClient = ReturnType<typeof createAppAuthClient>;
