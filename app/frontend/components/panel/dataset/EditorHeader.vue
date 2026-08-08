<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { DatasetStatus } from '@weave/types';
import { computed } from '#imports';

const props = withDefaults(defineProps<{
  title?: string;
  creatorName?: string;
  status?: DatasetStatus;
  canUpdate?: boolean;
  canArchive?: boolean;
  pending?: boolean;
}>(), {
  title: '未命名数据表',
  creatorName: '未知创建人',
  status: 'active',
  canUpdate: false,
  canArchive: false,
  pending: false,
});

const emit = defineEmits<{
  back: [];
  update: [];
  archive: [];
}>();

const actionItems = computed<DropdownMenuItem[][]>(() => [[
  ...(props.canUpdate ? [{
    label: '编辑信息',
    icon: 'i-solar-pen-2-bold-duotone',
    onSelect: () => emit('update'),
  }] : []),
  ...(props.canArchive ? [{
    label: '归档数据表',
    icon: 'i-solar-archive-down-bold-duotone',
    color: 'error' as const,
    onSelect: () => emit('archive'),
  }] : []),
]]);
</script>

<template>
  <header
    class="flex min-w-0 items-center justify-between gap-3 border-b border-default
      bg-default px-3 py-2.5 sm:px-5"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <UButton
        icon="i-solar-arrow-left-linear"
        color="neutral"
        variant="ghost"
        square
        class="size-10 shrink-0"
        aria-label="返回数据表列表"
        title="返回数据表列表"
        @click="emit('back')"
      />
      <div class="min-w-0">
        <div class="flex min-w-0 items-center gap-2">
          <h1 class="truncate text-base font-semibold tracking-tight text-highlighted sm:text-lg">
            {{ props.title }}
          </h1>
          <UBadge
            :label="status === 'active' ? '使用中' : '已归档'"
            :color="status === 'active' ? 'success' : 'neutral'"
            variant="subtle"
            size="sm"
            class="shrink-0"
          />
        </div>
        <p class="mt-0.5 truncate text-xs text-muted">
          创建人：{{ props.creatorName }}
        </p>
      </div>
    </div>

    <div class="hidden shrink-0 items-center gap-2 sm:flex">
      <UButton
        v-if="canUpdate"
        label="编辑信息"
        icon="i-solar-pen-2-bold-duotone"
        color="neutral"
        variant="outline"
        :disabled="pending"
        @click="emit('update')"
      />
      <UButton
        v-if="canArchive"
        label="归档"
        icon="i-solar-archive-down-bold-duotone"
        color="error"
        variant="soft"
        :loading="pending"
        @click="emit('archive')"
      />
    </div>

    <UDropdownMenu
      v-if="actionItems[0]?.length"
      :items="actionItems"
      :content="{ align: 'end', side: 'bottom', sideOffset: 8 }"
      class="shrink-0 sm:hidden"
    >
      <UButton
        icon="i-solar-menu-dots-bold-duotone"
        color="neutral"
        variant="ghost"
        square
        class="size-10"
        aria-label="更多数据表操作"
      />
    </UDropdownMenu>
  </header>
</template>
