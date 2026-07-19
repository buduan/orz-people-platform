<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
  }>(),
  {
    description: undefined,
  },
);
</script>

<template>
  <section class="rounded-2xl border border-default bg-default">
    <header class="flex items-start justify-between gap-4 border-b border-default px-6 py-4">
      <div>
        <h2 class="text-base font-semibold text-highlighted">
          {{ title }}
        </h2>
        <p
          v-if="description"
          class="mt-0.5 text-sm text-muted"
        >
          {{ description }}
        </p>
      </div>
      <slot name="actions" />
    </header>
    <div class="p-6">
      <slot />
    </div>
  </section>
</template>
