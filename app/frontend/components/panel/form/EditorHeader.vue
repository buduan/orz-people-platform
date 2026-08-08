<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

const props = withDefaults(defineProps<{
  title?: string;
  creatorName?: string;
}>(), {
  title: '未命名表单',
  creatorName: '未知创建人',
});

const emit = defineEmits<{
  back: [];
  source: [];
  save: [];
  publish: [];
}>();

const actionItems: DropdownMenuItem[][] = [[
  {
    label: '源码',
    icon: 'i-solar-code-bold-duotone',
    onSelect: () => emit('source'),
  },
  {
    label: '保存',
    icon: 'i-solar-diskette-bold-duotone',
    onSelect: () => emit('save'),
  },
  {
    label: '发布',
    icon: 'i-solar-upload-bold-duotone',
    color: 'primary',
    onSelect: () => emit('publish'),
  },
]];
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
        <p class="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <UIcon
            name="i-solar-user-rounded-bold-duotone"
            class="size-4 shrink-0"
          />
          <span class="truncate">创建人：{{ props.creatorName }}</span>
        </p>
      </div>
    </div>

    <div class="hidden shrink-0 items-center gap-2 md:flex">
      <UButton
        label="源码"
        icon="i-solar-code-bold-duotone"
        color="neutral"
        variant="outline"
        class="rounded-xl active:translate-y-px"
        @click="emit('source')"
      />
      <UButton
        label="保存"
        icon="i-solar-diskette-bold-duotone"
        color="neutral"
        variant="outline"
        class="rounded-xl active:translate-y-px"
        @click="emit('save')"
      />
      <UButton
        label="发布"
        icon="i-solar-upload-bold-duotone"
        color="primary"
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
