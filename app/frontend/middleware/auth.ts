import { resolveSafeRedirect } from '~/utils/redirect';

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore(useNuxtApp().$pinia);

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return navigateTo({
      path: '/auth/login',
      query: { redirect: to.fullPath },
    });
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    const origin = import.meta.client ? window.location.origin : useRequestURL().origin;
    return navigateTo(resolveSafeRedirect(to.query.redirect, origin));
  }

  return undefined;
});
