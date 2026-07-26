<script setup lang="ts">
/* eslint-disable vue/valid-v-for -- the template keys use typed v-for aliases */
import { shallowRef, useAuthFlow } from '#imports';
import type { MfaRequired } from '@orz-people-platform/types';

const props = defineProps<{
  identifier: string;
  redirect?: string;
}>();

const emit = defineEmits<{
  authenticated: [];
  back: [];
  mfaRequired: [challenge: MfaRequired];
}>();

const {
  busy, error, loginWithCode, loginWithPassword, requestLoginCode,
} = useAuthFlow();
const method = shallowRef<'code' | 'password'>('password');
const password = shallowRef('');
const code = shallowRef('');
const showPassword = shallowRef(false);
const codeSent = shallowRef(false);
const status = shallowRef('');
const methodTabs = [
  { value: 'password', label: '密码登录' },
  { value: 'code', label: '验证码登录' },
] as const;

function togglePasswordVisibility(): void {
  showPassword.value = !showPassword.value;
}

async function safely(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
    // useAuthFlow already exposes the safe inline error.
  }
}

async function handlePassword(): Promise<void> {
  await safely(async () => {
    const result = await loginWithPassword(props.identifier, password.value);
    if (result.outcome === 'mfa_required') emit('mfaRequired', result);
    else emit('authenticated');
  });
}

async function sendCode(): Promise<void> {
  await safely(async () => {
    await requestLoginCode(props.identifier);
    codeSent.value = true;
    status.value = '如果账号可用，验证码已经发送到已验证邮箱。';
  });
}

async function handleCode(): Promise<void> {
  await safely(async () => {
    await loginWithCode(props.identifier, code.value);
    emit('authenticated');
  });
}
</script>

<template>
  <div>
    <button
      type="button"
      class="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold
        text-muted hover:text-highlighted focus-visible:outline-2 focus-visible:outline-primary"
      @click="$emit('back')"
    >
      <UIcon
        name="i-solar-arrow-left-linear"
        class="size-4"
      />
      {{ identifier }}
    </button>

    <div
      class="grid grid-cols-2 rounded-xl bg-elevated p-1"
      role="tablist"
      aria-label="登录方式"
    >
      <template
        v-for="item in methodTabs"
        :key="item.value"
      >
        <button
          :id="`login-tab-${item.value}`"
          type="button"
          role="tab"
          :aria-selected="method === item.value"
          :aria-controls="`login-panel-${item.value}`"
          class="min-h-11 rounded-lg px-3 text-sm font-bold transition-colors
            focus-visible:outline-2 focus-visible:outline-primary"
          :class="method === item.value
            ? 'bg-default text-highlighted shadow-sm'
            : 'text-muted hover:text-highlighted'"
          @click="method = item.value"
          @keydown.left.prevent="method = method === 'password' ? 'code' : 'password'"
          @keydown.right.prevent="method = method === 'password' ? 'code' : 'password'"
        >
          {{ item.label }}
        </button>
      </template>
    </div>

    <form
      v-if="method === 'password'"
      id="login-panel-password"
      class="mt-6 space-y-5"
      role="tabpanel"
      aria-labelledby="login-tab-password"
      @submit.prevent="handlePassword"
    >
      <UFormField
        label="密码"
        name="password"
        :error="error || undefined"
        required
      >
        <UInput
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          autofocus
          required
          maxlength="128"
          size="xl"
          class="w-full"
        >
          <template #trailing>
            <UButton
              type="button"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              :icon="showPassword ? 'i-solar-eye-closed-linear' : 'i-solar-eye-linear'"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="togglePasswordVisibility"
            />
          </template>
        </UInput>
      </UFormField>

      <div class="flex justify-end">
        <NuxtLink
          :to="{ path: '/auth/forgot-password', query: { redirect } }"
          class="rounded text-sm font-semibold text-primary focus-visible:outline-2"
        >
          忘记密码？
        </NuxtLink>
      </div>

      <UButton
        type="submit"
        label="登录"
        size="xl"
        block
        :loading="busy"
        :disabled="busy || !password"
        class="min-h-11"
      />
    </form>

    <form
      v-else
      id="login-panel-code"
      class="mt-6 space-y-5"
      role="tabpanel"
      aria-labelledby="login-tab-code"
      @submit.prevent="handleCode"
    >
      <UFormField
        label="6 位邮箱验证码"
        name="code"
        :error="error || undefined"
        required
      >
        <UInput
          v-model="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          pattern="[0-9]{6}"
          maxlength="6"
          autofocus
          required
          size="xl"
          placeholder="000000"
          class="w-full font-mono tracking-[0.35em]"
        />
      </UFormField>

      <p
        class="text-sm leading-6 text-muted"
        aria-live="polite"
      >
        {{ status || '验证码只会发送到账号已经验证的邮箱。' }}
      </p>

      <div class="grid gap-3 sm:grid-cols-2">
        <UButton
          type="button"
          :label="codeSent ? '重新发送验证码' : '发送验证码'"
          color="neutral"
          variant="outline"
          size="xl"
          :loading="busy && !code"
          :disabled="busy"
          class="min-h-11"
          @click="sendCode"
        />
        <UButton
          type="submit"
          label="验证并登录"
          size="xl"
          :loading="busy && !!code"
          :disabled="busy || !/^\d{6}$/.test(code)"
          class="min-h-11"
        />
      </div>
    </form>
  </div>
</template>
