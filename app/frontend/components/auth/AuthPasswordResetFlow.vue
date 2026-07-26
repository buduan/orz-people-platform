<script setup lang="ts">
import {
  computed, shallowRef, useAuthFlow,
} from '#imports';
import { validatePassword } from '@orz-people-platform/utils';

const emit = defineEmits<{
  cancel: [];
  completed: [];
}>();

const {
  busy, error, requestPasswordReset, resetPassword,
} = useAuthFlow();
const step = shallowRef<'code' | 'email' | 'password'>('email');
const email = shallowRef('');
const code = shallowRef('');
const password = shallowRef('');
const showPassword = shallowRef(false);
const status = shallowRef('');
const passwordResult = computed(() => validatePassword(password.value));

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

async function requestCode(): Promise<void> {
  await safely(async () => {
    await requestPasswordReset(email.value);
    status.value = '如果邮箱对应可用账号，验证码已经发送。';
    step.value = 'code';
  });
}

function acceptCode(): void {
  step.value = 'password';
}

async function complete(): Promise<void> {
  await safely(async () => {
    await resetPassword(email.value, code.value, password.value);
    emit('completed');
  });
}
</script>

<template>
  <div class="space-y-6">
    <button
      type="button"
      class="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-muted
        focus-visible:outline-2 focus-visible:outline-primary"
      @click="$emit('cancel')"
    >
      <UIcon
        name="i-solar-arrow-left-linear"
        class="size-4"
      />
      返回登录
    </button>

    <form
      v-if="step === 'email'"
      class="space-y-5"
      @submit.prevent="requestCode"
    >
      <UFormField
        label="账号邮箱"
        name="reset-email"
        :error="error || undefined"
        required
      >
        <UInput
          v-model="email"
          type="email"
          autocomplete="email"
          autofocus
          required
          size="xl"
          class="w-full"
        />
      </UFormField>
      <p class="text-sm leading-6 text-muted">
        为保护账号信息，无论邮箱是否存在，下一步提示都保持一致。
      </p>
      <UButton
        type="submit"
        label="发送验证码"
        size="xl"
        block
        :loading="busy"
        :disabled="busy || !email"
        class="min-h-11"
      />
    </form>

    <form
      v-else-if="step === 'code'"
      class="space-y-5"
      @submit.prevent="acceptCode"
    >
      <UFormField
        label="6 位验证码"
        name="reset-code"
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
          class="w-full font-mono tracking-[0.35em]"
        />
      </UFormField>
      <p
        class="text-sm text-muted"
        aria-live="polite"
      >
        {{ status }}
      </p>
      <UButton
        type="submit"
        label="继续"
        size="xl"
        block
        :disabled="!/^\d{6}$/.test(code)"
        class="min-h-11"
      />
    </form>

    <form
      v-else
      class="space-y-5"
      @submit.prevent="complete"
    >
      <UFormField
        label="新密码"
        name="new-password"
        :error="error || undefined"
        required
      >
        <UInput
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          autofocus
          required
          minlength="9"
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
      <p
        class="text-sm leading-6"
        :class="passwordResult.valid ? 'text-primary' : 'text-muted'"
      >
        使用 9–128 位可见字符，并至少包含大写、小写、数字、符号中的三类。
      </p>
      <UButton
        type="submit"
        label="设置新密码"
        size="xl"
        block
        :loading="busy"
        :disabled="busy || !passwordResult.valid"
        class="min-h-11"
      />
    </form>
  </div>
</template>
