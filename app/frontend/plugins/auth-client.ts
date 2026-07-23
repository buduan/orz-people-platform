import { createAppAuthClient } from '../utils/auth-client';

export default defineNuxtPlugin(() => {
  const authClient = createAppAuthClient();

  return {
    provide: {
      auth: authClient,
    },
  };
});
