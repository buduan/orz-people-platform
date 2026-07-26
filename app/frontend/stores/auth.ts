import type {
  AuthenticatedActor,
  AuthTokens,
  UserProfile,
} from '@orz-people-platform/types';
import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', () => {
  // --- State ---

  // Access Token：短期 JWT，通过 Authorization: Bearer 携带
  const accessToken = useCookie<string | null>('orz_access_token', {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60, // 1h，与后端 access TTL 对齐
  });

  // Refresh Token：高熵随机不透明字符串，同样通过 Authorization: Bearer 携带
  const refreshToken = useCookie<string | null>('orz_refresh_token', {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30d
  });

  const profile = ref<UserProfile | null>(null);
  const actor = ref<AuthenticatedActor | null>(null);

  // --- Getters ---

  const isAuthenticated = computed(() => !!accessToken.value);
  const isSystemAdmin = computed(() => actor.value?.isSystemAdmin ?? false);
  const isWorkspaceAdmin = computed(() => actor.value?.isWorkspaceAdmin ?? false);

  /** 检查当前用户是否拥有指定权限 */
  function hasPermission(key: string): boolean {
    return actor.value?.permissions.includes(key as never) ?? false;
  }

  // --- State Mutations ---

  /** 设置 token 对（登录/刷新后调用） */
  function setTokens(tokens: AuthTokens): void {
    accessToken.value = tokens.accessToken;
    refreshToken.value = tokens.refreshToken;
  }

  function setProfile(user: UserProfile): void {
    profile.value = user;
  }

  function setActor(actorData: AuthenticatedActor): void {
    actor.value = actorData;
  }

  /** 清除所有认证状态 */
  function clear(): void {
    accessToken.value = null;
    refreshToken.value = null;
    profile.value = null;
    actor.value = null;
  }

  // --- 过期 Token 处理（预留） ---

  /**
   * Access Token 过期处理回调，由 API 客户端在 401 时触发。
   *
   * TODO: 待后端确认 JWT payload 结构后，实现更精细的过期判断：
   * - 可在登录时解析 JWT 的 `exp` 字段，本地预判过期
   * - 过期时自动调用 refresh，重试原始请求
   * - refresh 也失败时才跳转登录
   *
   * 当前简化实现：清除状态并跳转登录页。
   */
  function onAccessTokenExpired(): void {
    // 避免在已登出状态下重复跳转
    if (!accessToken.value && !refreshToken.value) return;

    clear();

    if (import.meta.client) {
      navigateTo('/auth/login');
    }
  }

  // --- Actions ---

  /** 获取当前用户信息 */
  async function fetchProfile(): Promise<void> {
    const { $api } = useNuxtApp();
    const user = await $api.get<UserProfile>('/users/me');
    setProfile(user);
  }

  /**
   * 登录（后端 auth API 实现后对接）。
   * 预期后端 POST /auth/login 返回 AuthTokens。
   */
  async function login(credentials: { email: string; password: string }): Promise<void> {
    const { $api } = useNuxtApp();

    // 登录接口不需要携带 token
    const tokens = await $api.post<AuthTokens>('/auth/login', credentials, { auth: 'none' });
    setTokens(tokens);

    await fetchProfile();
  }

  /**
   * 刷新 Access Token（后端 auth API 实现后对接）。
   * 预期后端 POST /auth/refresh 返回新的 AuthTokens。
   * 使用 refresh token 鉴权（通过 auth: 'refresh' 指定）。
   */
  async function refreshTokens(): Promise<void> {
    if (!refreshToken.value) {
      onAccessTokenExpired();
      return;
    }

    const { $api } = useNuxtApp();
    const tokens = await $api.post<AuthTokens>('/auth/refresh', undefined, { auth: 'refresh' });
    setTokens(tokens);
  }

  /** 登出（后端 auth API 实现后对接） */
  async function logout(): Promise<void> {
    const { $api } = useNuxtApp();

    try {
      await $api.post('/auth/logout', undefined);
    } finally {
      clear();
      await navigateTo('/auth/login');
    }
  }

  return {
    // state
    accessToken,
    refreshToken,
    profile,
    actor,
    // getters
    isAuthenticated,
    isSystemAdmin,
    isWorkspaceAdmin,
    // methods
    hasPermission,
    setTokens,
    setProfile,
    setActor,
    clear,
    onAccessTokenExpired,
    login,
    refreshTokens,
    fetchProfile,
    logout,
  };
});

// HMR 支持
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
