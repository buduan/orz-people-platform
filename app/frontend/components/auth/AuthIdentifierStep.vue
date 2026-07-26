<script setup lang="ts">
const identifier = defineModel<string>({ required: true });

defineProps<{
  busy?: boolean;
  error?: string | null;
}>();

defineEmits<{
  continue: [];
  passkey: [];
}>();
</script>

<template>
  <form
    class="space-y-5"
    @submit.prevent="$emit('continue')"
  >
    <UFormField
      label="邮箱、手机号或用户名"
      name="identifier"
      :error="error || undefined"
      required
    >
      <UInput
        v-model="identifier"
        type="text"
        autocomplete="username webauthn"
        autofocus
        required
        size="xl"
        placeholder="name@example.com"
        class="w-full"
      />
    </UFormField>

    <p
      class="sr-only"
      aria-live="polite"
    >
      {{ error }}
    </p>

    <UButton
      type="submit"
      label="继续"
      trailing-icon="i-solar-arrow-right-linear"
      size="xl"
      block
      :loading="busy"
      :disabled="busy || !identifier.trim()"
      class="min-h-11"
    />

    <div
      class="flex items-center gap-3"
      aria-hidden="true"
    >
      <USeparator class="flex-1" />
      <span class="text-xs text-muted">或者</span>
      <USeparator class="flex-1" />
    </div>

    <UButton
      type="button"
      label="使用通行密钥登录"
      icon="i-solar-key-minimalistic-square-2-bold-duotone"
      color="neutral"
      variant="outline"
      size="xl"
      block
      :loading="busy"
      :disabled="busy"
      class="min-h-11"
      @click="$emit('passkey')"
    />
  </form>
</template>
