<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value?: number | null;
    hint?: string;
  }>(),
  {
    value: null,
    hint: undefined,
  },
);

const formatValue = (input: number) => new Intl.NumberFormat('en-US').format(input);
</script>

<template>
  <div class="px-6 py-5">
    <p class="text-xs font-semibold uppercase tracking-wide text-muted">
      {{ label }}
    </p>
    <p class="mt-2 font-mono text-3xl font-semibold tabular-nums text-highlighted">
      <template v-if="value !== null">
        {{ formatValue(value) }}
      </template>
      <span
        v-else
        class="text-dimmed"
        aria-label="No data yet"
      >—</span>
    </p>
    <p
      v-if="hint"
      class="mt-1 text-xs text-muted"
    >
      {{ hint }}
    </p>
  </div>
</template>
