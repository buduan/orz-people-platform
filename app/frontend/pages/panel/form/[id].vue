<script setup lang="ts">
import { definePageMeta } from '#imports';

definePageMeta({
  layout: 'dashboard',
  title: '表单编辑',
});
</script>

<template>
  <div class="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden lg:h-[100dvh]">
    <PanelFormEditorHeader class="shrink-0" />

    <div class="grid min-h-0 flex-1 grid-cols-4">
      <aside class="min-h-0 min-w-0 overflow-y-auto border-r border-default bg-default">
        <PanelFormPalette />
      </aside>

      <section
        aria-label="表单画布"
        class="col-span-2 min-h-0 min-w-0 overflow-y-auto bg-muted"
      />

      <aside class="min-h-0 min-w-0 overflow-y-auto border-l border-default bg-default">
        <PanelFormSettings />
      </aside>
    </div>
  </div>
</template>
