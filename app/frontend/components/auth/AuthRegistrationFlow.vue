<script setup lang="ts">
import { onMounted, shallowRef, useAuthFlow } from '#imports';

const props = withDefaults(defineProps<{
  initialEmail?: string;
  startImmediately?: boolean;
  variant?: 'full' | 'simple';
}>(), {
  initialEmail: '',
  startImmediately: false,
  variant: 'full',
});

const emit = defineEmits<{
  authenticated: [];
  cancel: [];
}>();

const {
  busy,
  completeRegistration,
  error,
  requestRegistrationCode,
  startRegistration,
  verifyRegistrationCode,
} = useAuthFlow();
const email = shallowRef(props.initialEmail);
const name = shallowRef('');
const username = shallowRef('');
const code = shallowRef('');
const registrationId = shallowRef('');
const step = shallowRef<'code' | 'details' | 'email' | 'profile'>(
  props.variant === 'simple' ? 'details' : 'email',
);
const status = shallowRef('');

async function safely(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
    // useAuthFlow already exposes the safe inline error.
  }
}

async function begin(): Promise<void> {
  await safely(async () => {
    const started = await startRegistration(email.value);
    registrationId.value = started.registrationId;
    step.value = 'code';
    status.value = '验证码已发送，请检查邮箱。';
  });
}

async function beginSimple(): Promise<void> {
  await begin();
}

async function finish(): Promise<void> {
  await safely(async () => {
    await completeRegistration({
      registrationId: registrationId.value,
      name: name.value.trim(),
      ...(props.variant === 'full' ? { username: username.value.trim() } : {}),
    });
    emit('authenticated');
  });
}

async function verify(): Promise<void> {
  await safely(async () => {
    await verifyRegistrationCode(registrationId.value, code.value);
    if (props.variant === 'simple') {
      await finish();
      return;
    }
    step.value = 'profile';
    status.value = '邮箱验证完成，请完善账号信息。';
  });
}

async function resend(): Promise<void> {
  await safely(async () => {
    await requestRegistrationCode(registrationId.value);
    status.value = '验证码已重新发送。';
  });
}

onMounted(() => {
  if (props.startImmediately && props.initialEmail) begin();
});
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
      @submit.prevent="begin"
    >
      <UFormField
        label="邮箱"
        name="email"
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
      v-else-if="step === 'details'"
      class="space-y-5"
      @submit.prevent="beginSimple"
    >
      <UFormField
        label="姓名"
        name="name"
        required
      >
        <UInput
          v-model="name"
          autocomplete="name"
          autofocus
          required
          maxlength="128"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="邮箱"
        name="email"
        :error="error || undefined"
        required
      >
        <UInput
          v-model="email"
          type="email"
          autocomplete="email"
          required
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UButton
        type="submit"
        label="发送验证码"
        size="xl"
        block
        :loading="busy"
        :disabled="busy || !email || !name.trim()"
        class="min-h-11"
      />
    </form>

    <form
      v-else-if="step === 'code'"
      class="space-y-5"
      @submit.prevent="verify"
    >
      <div>
        <h2 class="text-xl font-bold">
          验证邮箱
        </h2>
        <p class="mt-2 text-sm leading-6 text-muted">
          输入发送到 {{ email }} 的 6 位验证码。
        </p>
      </div>
      <UFormField
        label="邮箱验证码"
        name="registration-code"
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
          class="w-full font-mono tracking-[0.35em]"
        />
      </UFormField>
      <p
        class="text-sm text-muted"
        aria-live="polite"
      >
        {{ status }}
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <UButton
          type="button"
          label="重新发送"
          color="neutral"
          variant="outline"
          size="xl"
          :disabled="busy"
          class="min-h-11"
          @click="resend"
        />
        <UButton
          type="submit"
          :label="variant === 'simple' ? '验证并注册' : '验证邮箱'"
          size="xl"
          :loading="busy"
          :disabled="busy || !/^\d{6}$/.test(code)"
          class="min-h-11"
        />
      </div>
    </form>

    <form
      v-else
      class="space-y-5"
      @submit.prevent="finish"
    >
      <div>
        <h2 class="text-xl font-bold">
          完善账号信息
        </h2>
        <p class="mt-2 text-sm leading-6 text-muted">
          用户名用于登录与成员识别，之后仍可在资料页修改。
        </p>
      </div>
      <UFormField
        label="姓名"
        name="name"
        required
      >
        <UInput
          v-model="name"
          autocomplete="name"
          autofocus
          required
          maxlength="128"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="用户名"
        name="username"
        hint="3–64 位，以字母开头，可使用数字、_ 和 -"
        :error="error || undefined"
        required
      >
        <UInput
          v-model="username"
          autocomplete="username"
          required
          pattern="[a-z][a-z0-9_-]{2,63}"
          maxlength="64"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <p
        class="sr-only"
        aria-live="polite"
      >
        {{ status }} {{ error }}
      </p>
      <UButton
        type="submit"
        label="完成注册"
        size="xl"
        block
        :loading="busy"
        :disabled="busy || !name.trim() || !/^[a-z][a-z0-9_-]{2,63}$/.test(username)"
        class="min-h-11"
      />
    </form>
  </div>
</template>
