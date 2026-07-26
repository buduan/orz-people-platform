<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { WorkspaceSummary } from '@orz-people-platform/types';
import { computed } from '#imports';

type WorkspaceOption = Pick<WorkspaceSummary, 'id' | 'name' | 'slug'>;

const props = defineProps<{
  workspaces: WorkspaceOption[];
}>();

const workspaceId = defineModel<number>('workspaceId', { required: true });

const currentWorkspace = computed(() => (
  props.workspaces.find((workspace) => workspace.id === workspaceId.value)
  ?? props.workspaces[0]
));

const workspaceInitials = computed(() => (
  currentWorkspace.value?.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
  ?? 'WS'
));

const workspaceItems = computed<DropdownMenuItem[][]>(() => [
  [{
    label: 'Switch workspace',
    type: 'label',
  }],
  props.workspaces.map((workspace) => ({
    label: workspace.name,
    icon: 'i-solar-buildings-3-bold-duotone',
    trailingIcon: workspace.id === workspaceId.value
      ? 'i-solar-check-circle-bold-duotone'
      : undefined,
    onSelect: () => {
      workspaceId.value = workspace.id;
    },
  })),
]);
</script>

<template>
  <UDropdownMenu
    :items="workspaceItems"
    :content="{ align: 'start', side: 'bottom', sideOffset: 8 }"
    :portal="false"
    :ui="{
      content: 'z-50 w-[17rem] rounded-xl bg-default shadow-xl ring-1 ring-default',
    }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      class="group min-h-16 rounded-2xl border border-default bg-muted
        px-2.5 text-left shadow-sm hover:bg-elevated active:translate-y-px"
      :ui="{
        base: 'justify-start transition-[transform,background-color] duration-200',
      }"
      aria-label="Switch workspace"
    >
      <span
        class="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10
          text-xs font-bold tracking-[0.08em] text-primary ring-1 ring-primary/20"
      >
        {{ workspaceInitials }}
      </span>

      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold text-highlighted">
          {{ currentWorkspace?.name ?? 'Select workspace' }}
        </span>
        <span class="mt-0.5 block truncate text-xs text-muted">
          {{ currentWorkspace ? `@${currentWorkspace.slug}` : 'No workspace available' }}
        </span>
      </span>

      <UIcon
        name="i-solar-alt-arrow-down-bold-duotone"
        class="size-4 shrink-0 text-dimmed transition-colors group-hover:text-highlighted"
      />
    </UButton>
  </UDropdownMenu>
</template>
