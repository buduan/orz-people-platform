<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui';

import { computed, useRoute } from '#imports';

const route = useRoute();

const items = computed<BreadcrumbItem[]>(() => {
  const { title } = route.meta;

  return [
    {
      label: '仪表盘',
      to: '/dashboard',
    },
    ...(typeof title === 'string' ? [{ label: title }] : []),
  ];
});
</script>

<template>
  <UBreadcrumb :items="items" />
</template>
