<script setup lang="ts">
import { computed } from '#imports';

const props = defineProps<{
  user: {
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  };
}>();

const emit = defineEmits<{
  logout: [];
}>();

const avatarText = computed(() => (
  props.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
  || 'U'
));
</script>

<template>
  <div
    class="flex min-h-16 items-center gap-3 rounded-2xl border border-default
      bg-muted p-2.5 shadow-sm"
  >
    <UAvatar
      :src="user.avatarUrl ?? undefined"
      :alt="user.name"
      :text="avatarText"
      size="md"
      class="shrink-0 bg-default text-muted ring-1 ring-default"
    />

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold text-highlighted">
        {{ user.name }}
      </p>
      <p class="mt-0.5 truncate text-xs text-muted">
        {{ user.email || user.role }}
      </p>
    </div>

    <UTooltip text="Log out">
      <UButton
        icon="i-solar-logout-2-bold-duotone"
        color="neutral"
        variant="ghost"
        size="sm"
        square
        class="shrink-0 rounded-xl text-dimmed hover:bg-elevated
          hover:text-highlighted active:translate-y-px"
        aria-label="Log out"
        @click="emit('logout')"
      />
    </UTooltip>
  </div>
</template>
