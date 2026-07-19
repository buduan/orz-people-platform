<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
  description: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center gap-3 py-10 text-center">
    <span class="flex size-12 items-center justify-center rounded-full bg-elevated">
      <UIcon
        :name="icon"
        class="size-5 text-muted"
      />
    </span>
    <div>
      <p class="text-sm font-semibold text-highlighted">
        {{ title }}
      </p>
      <p class="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted">
        {{ description }}
      </p>
    </div>
    <slot />
  </div>
</template>
