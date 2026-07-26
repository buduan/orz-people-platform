export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();

  // 需要登录才能访问的页面
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return navigateTo('/auth/login');
  }

  // 仅限未登录用户访问的页面（如登录、注册页）
  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return navigateTo('/');
  }

  return undefined;
});
