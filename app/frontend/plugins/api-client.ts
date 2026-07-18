import { createApiClient } from '../utils/api-client';

export default defineNuxtPlugin(() => {
  const configuration = useRuntimeConfig();

  return {
    provide: {
      api: createApiClient({ baseUrl: configuration.public.apiBase }),
    },
  };
});
