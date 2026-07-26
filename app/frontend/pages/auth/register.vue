<script setup lang="ts">
import {
  computed, definePageMeta, navigateTo, useRequestURL, useRoute,
} from '#imports';

import { resolveSafeRedirect } from '~/utils/redirect';

definePageMeta({
  guestOnly: true,
  middleware: 'auth',
});

const route = useRoute();
const redirect = computed(() => resolveSafeRedirect(route.query.redirect, useRequestURL().origin));

async function authenticated(): Promise<void> {
  await navigateTo(redirect.value);
}
</script>

<template>
  <AuthShell
    eyebrow="Create account"
    title="创建你的账号"
    description="验证邮箱并设置清晰、可识别的成员信息。"
  >
    <AuthRegistrationFlow
      variant="full"
      @authenticated="authenticated"
      @cancel="navigateTo({ path: '/auth/login', query: { redirect } })"
    />
  </AuthShell>
</template>
