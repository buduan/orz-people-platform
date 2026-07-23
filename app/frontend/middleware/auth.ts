export default defineNuxtRouteMiddleware(async (to) => {
  // The Better Auth session cookie is set on the API origin and is not available
  // to Nuxt during SSR, so authorization is resolved on the client where the
  // browser attaches credentials to the auth request.
  if (import.meta.server) {
    return;
  }

  const auth = useAuthClient();
  const { data } = await auth.getSession();

  if (!data) {
    return navigateTo({ path: '/auth/login', query: { redirect: to.fullPath } });
  }
});
