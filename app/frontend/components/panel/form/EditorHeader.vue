<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import { computed } from '#imports';

const props = withDefaults(defineProps<{
  title?: string;
  creatorName?: string;
  dirty?: boolean;
  disabled?: boolean;
  lockLabel?: string;
  publishing?: boolean;
  saving?: boolean;
}>(), {
  title: '未命名表单',
  creatorName: '未知创建人',
  dirty: false,
  disabled: false,
  lockLabel: '正在连接编辑会话',
  publishing: false,
  saving: false,
});

const emit = defineEmits<{
  back: [];
  source: [];
  save: [];
  publish: [];
}>();

const actionItems = computed<DropdownMenuItem[][]>(() => [[
  {
    label: '源码',
    icon: 'i-solar-code-bold-duotone',
    disabled: props.disabled,
    onSelect: () => emit('source'),
  },
  {
    label: '保存',
    icon: 'i-solar-diskette-bold-duotone',
    disabled: props.disabled || props.saving,
    onSelect: () => emit('save'),
  },
  {
    label: '发布',
    icon: 'i-solar-upload-bold-duotone',
    color: 'primary',
    disabled: props.disabled || props.publishing,
    onSelect: () => emit('publish'),
  },
]]);
</script>

<template>
  <header
    class="flex min-w-0 items-center justify-between gap-3 border-b border-default
      bg-default px-4 py-3 sm:px-6"
  >
    <div class="flex min-w-0 items-center gap-3">
      <UButton
        icon="i-solar-arrow-left-linear"
        color="neutral"
        variant="ghost"
        square
        class="size-11 shrink-0 rounded-xl text-muted hover:bg-elevated
          hover:text-highlighted active:translate-y-px"
        aria-label="返回"
        title="返回"
        @click="emit('back')"
      />

      <div class="min-w-0">
        <h1 class="truncate text-base font-semibold tracking-tight text-highlighted sm:text-lg">
          {{ props.title }}
        </h1>
        <p class="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted">
          <UIcon
            name="i-solar-user-rounded-bold-duotone"
            class="size-4 shrink-0"
          />
          <span class="truncate">创建人：{{ props.creatorName }}</span>
          <span aria-hidden="true">·</span>
          <span :class="props.disabled ? 'text-warning' : 'text-success'">
            {{ props.lockLabel }}
          </span>
          <UBadge
            v-if="props.dirty"
            label="未保存"
            color="warning"
            variant="subtle"
            size="sm"
          />
        </p>
      </div>
    </div>

    <div class="hidden shrink-0 items-center gap-2 md:flex">
      <UButton
        label="源码"
        icon="i-solar-code-bold-duotone"
        color="neutral"
        variant="outline"
        :disabled="props.disabled"
        class="rounded-xl active:translate-y-px"
        @click="emit('source')"
      />
      <UButton
        label="保存"
        icon="i-solar-diskette-bold-duotone"
        color="neutral"
        variant="outline"
        :disabled="props.disabled"
        :loading="props.saving"
        class="rounded-xl active:translate-y-px"
        @click="emit('save')"
      />
      <UButton
        label="发布"
        icon="i-solar-upload-bold-duotone"
        color="primary"
        :disabled="props.disabled"
        :loading="props.publishing"
        class="rounded-xl active:translate-y-px"
        @click="emit('publish')"
      />
    </div>

    <UDropdownMenu
      :items="actionItems"
      :content="{ align: 'end', side: 'bottom', sideOffset: 8 }"
      class="shrink-0 md:hidden"
    >
      <UButton
        icon="i-solar-menu-dots-bold-duotone"
        color="neutral"
        variant="ghost"
        square
        class="size-11 rounded-xl text-muted hover:bg-elevated
          hover:text-highlighted active:translate-y-px"
        aria-label="更多操作"
      />
    </UDropdownMenu>
  </header>
</template>
