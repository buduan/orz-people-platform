<script setup lang="ts">
import { definePageMeta } from '#imports';

definePageMeta({
  layout: 'dashboard',
  title: '数据表',
  requiresAuth: true,
});
</script>

<template>
  <PanelDatasetList />
</template>
