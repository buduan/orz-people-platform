import {
  apiStatuses,
  type ApiStatus,
  type AuthenticationResult,
  type AuthCompleted,
  type LoginOptions,
  type MfaFactor,
  type RegistrationStarted,
  type RegistrationVerified,
} from '@orz-people-platform/types';

import { toApiError } from '~/utils/api';

interface PasskeyRequestOptionsJSON
  extends Omit<PublicKeyCredentialRequestOptions, 'allowCredentials' | 'challenge'> {
  allowCredentials?: Array<Omit<PublicKeyCredentialDescriptor, 'id'> & { id: string }>;
  challenge: string;
}

interface PasskeyOptionsResult {
  challengeId: string;
  options: PasskeyRequestOptionsJSON;
}

interface MfaPasskeyOptionsResult {
  assertionId: string;
  options: PasskeyRequestOptionsJSON;
}

const authErrorMessages: Partial<Record<ApiStatus, string>> = {
  [apiStatuses.accountNotFound]: '账号不存在，请输入邮箱以创建账号。',
  [apiStatuses.invalidCredentials]: '账号或凭据不正确。',
  [apiStatuses.registrationExpired]: '注册验证已过期，请重新开始。',
  [apiStatuses.registrationUnverified]: '请先完成邮箱验证。',
  [apiStatuses.usernameUnavailable]: '该用户名已被使用，请更换一个。',
};

const authSuccessMessages: Partial<Record<string, { title: string; description: string }>> = {
  'login-code-request': { title: '验证码已发送', description: '请检查账号已验证的邮箱。' },
  'mfa-code-request': { title: '验证码已发送', description: '请检查对应的验证设备。' },
  'registration-start': { title: '验证码已发送', description: '请检查你的注册邮箱。' },
  'registration-code-request': { title: '验证码已重新发送', description: '请检查你的注册邮箱。' },
  'registration-code-verify': { title: '邮箱验证成功', description: '请继续完善账号信息。' },
  'password-reset-request': { title: '验证码已发送', description: '如果账号可用，请检查邮箱。' },
  'password-reset': { title: '密码已重置', description: '现在可以使用新密码登录。' },
};

export function authErrorMessage(error: unknown): string {
  const apiError = toApiError(error);
  return authErrorMessages[apiError.status] ?? apiError.message;
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  return new Uint8Array(bytes.buffer);
}

function encodeBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function nativeRequestOptions(
  options: PasskeyRequestOptionsJSON,
): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: decodeBase64Url(options.challenge),
    allowCredentials: options.allowCredentials?.map((credential) => ({
      ...credential,
      id: decodeBase64Url(credential.id),
    })),
  };
}

async function requestPasskey(options: PasskeyRequestOptionsJSON) {
  if (!import.meta.client || !window.PublicKeyCredential) {
    throw new Error('当前浏览器不支持通行密钥。');
  }
  const credential = await navigator.credentials.get({
    publicKey: nativeRequestOptions(options),
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('未获得有效的通行密钥凭据。');
  }
  const assertion = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    response: {
      authenticatorData: encodeBase64Url(assertion.authenticatorData),
      clientDataJSON: encodeBase64Url(assertion.clientDataJSON),
      signature: encodeBase64Url(assertion.signature),
      userHandle: assertion.userHandle ? encodeBase64Url(assertion.userHandle) : undefined,
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  };
}

export function useAuthFlow() {
  const { $api } = useNuxtApp();
  const authStore = useAuthStore(useNuxtApp().$pinia);
  const toast = useToast();
  const pendingAction = shallowRef<string | null>(null);
  const error = shallowRef<string | null>(null);
  const busy = computed(() => pendingAction.value !== null);

  async function run<T>(action: string, callback: () => Promise<T>): Promise<T> {
    if (pendingAction.value) throw new Error('已有认证请求正在进行。');
    pendingAction.value = action;
    error.value = null;
    try {
      const result = await callback();
      const success = authSuccessMessages[action];
      if (success) {
        toast.add({
          ...success,
          color: 'success',
          icon: 'i-solar-check-circle-bold-duotone',
        });
      }
      return result;
    } catch (caught: unknown) {
      const message = authErrorMessage(caught);
      error.value = message;
      toast.add({
        title: '操作未完成',
        description: message,
        color: 'error',
        icon: 'i-solar-danger-circle-bold-duotone',
      });
      throw caught;
    } finally {
      pendingAction.value = null;
    }
  }

  async function acceptAuthentication(result: AuthenticationResult): Promise<AuthenticationResult> {
    if (result.outcome === 'authenticated') {
      await authStore.completeAuthentication(result.tokens);
      toast.add({
        title: '认证成功',
        description: '正在进入你的账号。',
        color: 'success',
        icon: 'i-solar-check-circle-bold-duotone',
      });
    }
    return result;
  }

  function discover(identifier: string): Promise<LoginOptions> {
    return run('discover', () => $api.post<LoginOptions>(
      '/auth/login/options',
      { identifier },
      { auth: 'none' },
    ));
  }

  function loginWithPassword(identifier: string, password: string): Promise<AuthenticationResult> {
    return run('password-login', async () => acceptAuthentication(
      await $api.post<AuthenticationResult>(
        '/auth/login/password',
        { identifier, password },
        { auth: 'none' },
      ),
    ));
  }

  function requestLoginCode(identifier: string): Promise<{ accepted: true }> {
    return run('login-code-request', () => $api.post(
      '/auth/login/code/request',
      { identifier },
      { auth: 'none' },
    ));
  }

  function loginWithCode(identifier: string, code: string): Promise<AuthenticationResult> {
    return run('code-login', async () => acceptAuthentication(
      await $api.post<AuthCompleted>(
        '/auth/login/code/verify',
        { identifier, code },
        { auth: 'none' },
      ),
    ));
  }

  function loginWithPasskey(): Promise<AuthenticationResult> {
    return run('passkey-login', async () => {
      const ceremony = await $api.post<PasskeyOptionsResult>(
        '/auth/login/passkey/options',
        undefined,
        { auth: 'none' },
      );
      const response = await requestPasskey(ceremony.options);
      return acceptAuthentication(await $api.post<AuthCompleted>(
        '/auth/login/passkey/verify',
        { challengeId: ceremony.challengeId, response },
        { auth: 'none' },
      ));
    });
  }

  function requestMfaCode(challengeId: string, factor: Extract<MfaFactor, 'email' | 'sms'>) {
    return run('mfa-code-request', () => $api.post<{ accepted: true }>(
      '/auth/mfa/code/request',
      { challengeId, factor },
      { auth: 'none' },
    ));
  }

  function completeMfa(
    challengeId: string,
    factor: Exclude<MfaFactor, 'passkey'>,
    code: string,
  ): Promise<AuthenticationResult> {
    return run('mfa-complete', async () => acceptAuthentication(
      await $api.post<AuthCompleted>(
        '/auth/mfa/complete',
        { challengeId, factor, code },
        { auth: 'none' },
      ),
    ));
  }

  function completeMfaWithPasskey(challengeId: string): Promise<AuthenticationResult> {
    return run('mfa-passkey', async () => {
      const ceremony = await $api.post<MfaPasskeyOptionsResult>(
        '/auth/mfa/passkey/options',
        { challengeId },
        { auth: 'none' },
      );
      const response = await requestPasskey(ceremony.options);
      return acceptAuthentication(await $api.post<AuthCompleted>(
        '/auth/mfa/passkey/complete',
        { challengeId, assertionId: ceremony.assertionId, response },
        { auth: 'none' },
      ));
    });
  }

  function startRegistration(email: string): Promise<RegistrationStarted> {
    return run('registration-start', () => $api.post(
      '/auth/register/start',
      { email },
      { auth: 'none' },
    ));
  }

  function requestRegistrationCode(registrationId: string): Promise<{ accepted: true }> {
    return run('registration-code-request', () => $api.post(
      '/auth/register/code/request',
      { registrationId },
      { auth: 'none' },
    ));
  }

  function verifyRegistrationCode(
    registrationId: string,
    code: string,
  ): Promise<RegistrationVerified> {
    return run('registration-code-verify', () => $api.post(
      '/auth/register/code/verify',
      { registrationId, code },
      { auth: 'none' },
    ));
  }

  function completeRegistration(input: {
    registrationId: string;
    name: string;
    username?: string;
  }): Promise<AuthenticationResult> {
    return run('registration-complete', async () => acceptAuthentication(
      await $api.post<AuthCompleted>(
        '/auth/register/complete',
        input,
        { auth: 'none' },
      ),
    ));
  }

  function requestPasswordReset(email: string): Promise<{ accepted: true }> {
    return run('password-reset-request', () => $api.post(
      '/auth/password/reset/request',
      { email },
      { auth: 'none' },
    ));
  }

  function resetPassword(email: string, code: string, newPassword: string) {
    return run('password-reset', () => $api.post<{ accepted: true }>(
      '/auth/password/reset',
      { email, code, newPassword },
      { auth: 'none' },
    ));
  }

  return {
    busy,
    error: readonly(error),
    pendingAction: readonly(pendingAction),
    discover,
    loginWithPassword,
    requestLoginCode,
    loginWithCode,
    loginWithPasskey,
    requestMfaCode,
    completeMfa,
    completeMfaWithPasskey,
    startRegistration,
    requestRegistrationCode,
    verifyRegistrationCode,
    completeRegistration,
    requestPasswordReset,
    resetPassword,
  };
}
