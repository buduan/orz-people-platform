<script setup lang="ts">
/* eslint-disable vue/valid-v-for -- the template keys use typed v-for aliases */

const emit = defineEmits<{
  up: [];
  down: [];
  duplicate: [];
  settings: [];
  delete: [];
}>();

type EditEvent = 'delete' | 'down' | 'duplicate' | 'settings' | 'up';

interface EditAction {
  danger?: boolean;
  event: EditEvent;
  icon: string;
  label: string;
}

/** 编辑操作按钮集合，event 对应向外派发的事件名。 */
const actions: EditAction[] = [
  { icon: 'i-solar-arrow-up-bold-duotone', label: '上移', event: 'up' },
  { icon: 'i-solar-arrow-down-bold-duotone', label: '下移', event: 'down' },
  { icon: 'i-solar-copy-bold-duotone', label: '复制', event: 'duplicate' },
  {
    icon: 'i-solar-settings-minimalistic-bold-duotone',
    label: '字段设置',
    event: 'settings',
  },
  {
    icon: 'i-solar-trash-bin-trash-bold-duotone',
    label: '删除',
    event: 'delete',
    danger: true,
  },
];

/** 将事件名转发到类型精确的 emit 调用。 */
const handlers: Record<EditEvent, () => void> = {
  up: () => emit('up'),
  down: () => emit('down'),
  duplicate: () => emit('duplicate'),
  settings: () => emit('settings'),
  delete: () => emit('delete'),
};
</script>

<template>
  <div
    class="flex items-center gap-2 border-t border-default bg-neutral-50 p-3
      dark:bg-neutral-800"
  >
    <UButton
      v-for="action in actions"
      :key="action.event"
      :icon="action.icon"
      :color="action.danger ? 'error' : 'neutral'"
      variant="ghost"
      size="sm"
      square
      class="rounded-lg text-muted hover:bg-default hover:text-highlighted"
      :title="action.label"
      :aria-label="action.label"
      @click="handlers[action.event]"
    />
  </div>
</template>
