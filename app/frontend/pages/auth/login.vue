<script setup lang="ts">
import {
  computed,
  definePageMeta,
  navigateTo,
  shallowRef,
  useAuthFlow,
  useRequestURL,
  useRoute,
} from '#imports';
import type { MfaRequired } from '@orz-people-platform/types';

import { resolveSafeRedirect } from '~/utils/redirect';

definePageMeta({
  guestOnly: true,
  middleware: 'auth',
});

const route = useRoute();
const { origin } = useRequestURL();
const redirect = computed(() => resolveSafeRedirect(route.query.redirect, origin));
const identifier = shallowRef('');
const registrationEmail = shallowRef('');
const challenge = shallowRef<MfaRequired | null>(null);
const step = shallowRef<'identifier' | 'method' | 'mfa' | 'register'>('identifier');
const {
  busy, discover, error, loginWithPasskey,
} = useAuthFlow();

const shellCopy = computed(() => {
  if (step.value === 'register') {
    return { title: '创建你的账号', description: '先验证邮箱，再完善姓名与用户名。' };
  }
  if (step.value === 'mfa') {
    return { title: '确认是你本人', description: '使用已启用的第二重验证方式继续。' };
  }
  if (step.value === 'method') {
    return { title: '欢迎回来', description: '选择密码或邮箱验证码登录。' };
  }
  return { title: '登录或注册', description: '输入账号，我们会带你进入正确的下一步。' };
});

async function continueWithIdentifier(): Promise<void> {
  try {
    const options = await discover(identifier.value);
    if (options.next === 'register') {
      registrationEmail.value = options.email;
      step.value = 'register';
      return;
    }
    step.value = 'method';
  } catch {
    // The composable exposes the safe inline message.
  }
}

async function passkeyLogin(): Promise<void> {
  try {
    await loginWithPasskey();
    await navigateTo(redirect.value);
  } catch {
    // The composable exposes the safe inline message.
  }
}

function requireMfa(nextChallenge: MfaRequired): void {
  challenge.value = nextChallenge;
  step.value = 'mfa';
}

async function authenticated(): Promise<void> {
  await navigateTo(redirect.value);
}
</script>

<template>
  <AuthShell
    eyebrow="Account access"
    :title="shellCopy.title"
    :description="shellCopy.description"
  >
    <AuthIdentifierStep
      v-if="step === 'identifier'"
      v-model="identifier"
      :busy="busy"
      :error="error"
      @continue="continueWithIdentifier"
      @passkey="passkeyLogin"
    />

    <AuthLoginMethodStep
      v-else-if="step === 'method'"
      :identifier="identifier"
      :redirect="redirect"
      @authenticated="authenticated"
      @back="step = 'identifier'"
      @mfa-required="requireMfa"
    />

    <AuthMfaStep
      v-else-if="step === 'mfa' && challenge"
      :challenge="challenge"
      @authenticated="authenticated"
      @back="step = 'method'; challenge = null"
    />

    <AuthRegistrationFlow
      v-else
      variant="full"
      :initial-email="registrationEmail"
      start-immediately
      @authenticated="authenticated"
      @cancel="step = 'identifier'"
    />

    <p
      v-if="step === 'identifier'"
      class="mt-8 text-center text-sm text-muted"
    >
      没有账号也不用担心，邮箱不存在时会自动进入注册。
    </p>
  </AuthShell>
</template>
