import { createApiClient } from '~/utils/api';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  const api = createApiClient({
    baseURL: config.public.apiOrigin,
    getAccessToken: () => authStore.accessToken,
    getRefreshToken: () => authStore.refreshToken,
    onAccessTokenExpired: () => authStore.onAccessTokenExpired(),
  });

  return {
    provide: {
      api,
    },
  };
});
