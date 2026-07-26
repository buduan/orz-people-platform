<script setup lang="ts">
import {
  computed, definePageMeta, shallowRef, useRequestURL, useRoute,
} from '#imports';

import { resolveSafeRedirect } from '~/utils/redirect';

definePageMeta({
  guestOnly: true,
  middleware: 'auth',
});

const route = useRoute();
const redirect = computed(() => resolveSafeRedirect(route.query.redirect, useRequestURL().origin));
const completed = shallowRef(false);
</script>

<template>
  <AuthShell
    eyebrow="Account recovery"
    :title="completed ? '密码已更新' : '找回密码'"
    :description="completed
      ? '现在可以使用新密码继续登录。'
      : '通过账号邮箱验证码安全地设置一个新密码。'"
  >
    <div
      v-if="completed"
      class="space-y-5"
    >
      <div class="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <UIcon
          name="i-solar-check-circle-bold-duotone"
          class="size-7"
        />
      </div>
      <UButton
        :to="{ path: '/auth/login', query: { redirect } }"
        label="返回登录"
        size="xl"
        block
        class="min-h-11"
      />
    </div>
    <AuthPasswordResetFlow
      v-else
      @completed="completed = true"
      @cancel="navigateTo({ path: '/auth/login', query: { redirect } })"
    />
  </AuthShell>
</template>
