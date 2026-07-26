<script setup lang="ts">
/* eslint-disable vue/valid-v-for -- the template key uses the typed factor alias */
import {
  onBeforeUnmount, onMounted, shallowRef, useAuthFlow,
} from '#imports';
import type { MfaFactor, MfaRequired } from '@orz-people-platform/types';

const props = defineProps<{
  challenge: MfaRequired;
}>();

const emit = defineEmits<{
  authenticated: [];
  back: [];
}>();

const {
  busy, completeMfa, completeMfaWithPasskey, error, requestMfaCode,
} = useAuthFlow();
const selectedFactor = shallowRef<MfaFactor>(props.challenge.factors[0] ?? 'totp');
const code = shallowRef('');
const secondsLeft = shallowRef(props.challenge.expiresIn);
const status = shallowRef('请选择一种验证方式。');
let timer: ReturnType<typeof setInterval> | undefined;

const factorLabels: Record<MfaFactor, string> = {
  email: '邮箱验证码',
  sms: '手机验证码',
  totp: '验证器验证码',
  passkey: '通行密钥',
};

onMounted(() => {
  timer = setInterval(() => {
    secondsLeft.value = Math.max(0, secondsLeft.value - 1);
  }, 1000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

async function safely(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
    // useAuthFlow already exposes the safe inline error.
  }
}

async function sendCode(): Promise<void> {
  if (selectedFactor.value !== 'email' && selectedFactor.value !== 'sms') return;
  await safely(async () => {
    if (selectedFactor.value !== 'email' && selectedFactor.value !== 'sms') return;
    await requestMfaCode(props.challenge.challengeId, selectedFactor.value);
    status.value = '验证码已发送，请检查对应设备。';
  });
}

async function submit(): Promise<void> {
  await safely(async () => {
    if (selectedFactor.value === 'passkey') {
      await completeMfaWithPasskey(props.challenge.challengeId);
    } else {
      await completeMfa(props.challenge.challengeId, selectedFactor.value, code.value);
    }
    emit('authenticated');
  });
}
</script>

<template>
  <div class="space-y-6">
    <button
      type="button"
      class="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-muted
        focus-visible:outline-2 focus-visible:outline-primary"
      @click="$emit('back')"
    >
      <UIcon
        name="i-solar-arrow-left-linear"
        class="size-4"
      />
      返回登录
    </button>

    <div>
      <h2 class="text-xl font-bold tracking-tight">
        完成两步验证
      </h2>
      <p class="mt-2 text-sm leading-6 text-muted">
        此次验证将在 {{ secondsLeft }} 秒后过期。
      </p>
    </div>

    <div
      class="grid gap-2"
      role="radiogroup"
      aria-label="两步验证方式"
    >
      <template
        v-for="factor in challenge.factors"
        :key="factor"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="selectedFactor === factor"
          class="flex min-h-11 items-center justify-between rounded-xl border px-4 py-3 text-left
            text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary"
          :class="selectedFactor === factor
            ? 'border-primary bg-primary/5 text-highlighted'
            : 'border-default text-muted'"
          @click="selectedFactor = factor; code = ''"
        >
          {{ factorLabels[factor] }}
          <UIcon
            :name="selectedFactor === factor
              ? 'i-solar-check-circle-bold-duotone'
              : 'i-solar-circle-linear'"
            class="size-5"
            :class="selectedFactor === factor ? 'text-primary' : 'text-dimmed'"
          />
        </button>
      </template>
    </div>

    <form
      class="space-y-4"
      @submit.prevent="submit"
    >
      <template v-if="selectedFactor !== 'passkey'">
        <UFormField
          label="6 位验证码"
          name="mfa-code"
          :error="error || undefined"
          required
        >
          <UInput
            v-model="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]{6}"
            maxlength="6"
            required
            size="xl"
            class="w-full font-mono tracking-[0.35em]"
          />
        </UFormField>
        <UButton
          v-if="selectedFactor === 'email' || selectedFactor === 'sms'"
          type="button"
          label="发送验证码"
          color="neutral"
          variant="outline"
          size="lg"
          :disabled="busy || secondsLeft === 0"
          @click="sendCode"
        />
      </template>

      <p
        class="text-sm text-muted"
        aria-live="polite"
      >
        {{ secondsLeft === 0 ? '验证已过期，请返回并重新登录。' : status }}
      </p>

      <UButton
        type="submit"
        :label="selectedFactor === 'passkey' ? '使用通行密钥验证' : '完成验证'"
        :icon="selectedFactor === 'passkey'
          ? 'i-solar-key-minimalistic-square-2-bold-duotone'
          : undefined"
        size="xl"
        block
        :loading="busy"
        :disabled="busy || secondsLeft === 0
          || (selectedFactor !== 'passkey' && !/^\d{6}$/.test(code))"
        class="min-h-11"
      />
    </form>
  </div>
</template>
