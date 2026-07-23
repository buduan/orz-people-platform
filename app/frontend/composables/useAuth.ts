import type { AppAuthClient } from '../utils/auth-client';

export function useAuthClient(): AppAuthClient {
  return useNuxtApp().$auth as AppAuthClient;
}

export function useAuthSession() {
  return useAuthClient().useSession();
}
