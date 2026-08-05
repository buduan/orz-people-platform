<script setup lang="ts">
import { nextTick, ref } from '#imports';
import { useFormFieldEditing } from '~/composables/useFormFieldEditing';
import type { FocusableInputInstance } from './types';

const props = defineProps<{
  allowEdit?: boolean;
  description?: string;
  title: string;
}>();

/** 编辑态由共享互斥上下文派生：同一时刻至多一个字段处于编辑态。 */
const { editing } = useFormFieldEditing();

/** 编辑操作事件，由 FormFieldEditor 转发给调用方。 */
const emit = defineEmits<{
  up: [];
  down: [];
  duplicate: [];
  settings: [];
  delete: [];
  'update:title': [value: string];
  'update:description': [value?: string];
}>();

/** 标题 / 描述是否处于就地编辑态。 */
const titleEditing = ref(false);
const descriptionEditing = ref(false);

/** 标题 / 描述的内联编辑框引用，用于自动聚焦。 */
const titleInputRef = ref<FocusableInputInstance | null>(null);
const descriptionInputRef = ref<FocusableInputInstance | null>(null);

/** 标题 / 描述编辑中的本地值（提交时派发 update 事件）。 */
const titleDraft = ref(props.title);
const descriptionDraft = ref(props.description ?? '');

/** 聚焦标题 / 描述编辑框（兼容 UInput/UTextarea 暴露的 inputRef/textareaRef）。 */
function focusInput(target: FocusableInputInstance | null): void {
  if (target && 'focus' in target) {
    (target as { focus: () => void }).focus();
  } else if ('inputRef' in (target ?? {})) {
    (target as { inputRef: { focus: () => void } }).inputRef.focus();
  } else if ('textareaRef' in (target ?? {})) {
    (target as { textareaRef: { focus: () => void } }).textareaRef.focus();
  }
}

/** 点击编辑按钮后进入就地编辑态并聚焦。 */
function startTitleEdit(): void {
  titleDraft.value = props.title;
  titleEditing.value = true;
  nextTick(() => focusInput(titleInputRef.value));
}

function startDescriptionEdit(): void {
  descriptionDraft.value = props.description ?? '';
  descriptionEditing.value = true;
  nextTick(() => focusInput(descriptionInputRef.value));
}

/** 结束标题编辑并派发提交事件。 */
function finishTitleEdit(): void {
  titleEditing.value = false;
  if (titleDraft.value !== props.title) {
    emit('update:title', titleDraft.value);
  }
}

/** 结束描述编辑并派发提交事件。 */
function finishDescriptionEdit(): void {
  descriptionEditing.value = false;
  if (descriptionDraft.value !== (props.description ?? '')) {
    emit('update:description', descriptionDraft.value || undefined);
  }
}

/** allowEdit 时点击字段卡片进入编辑态（自动抢占互斥）。 */
function enterEdit(): void {
  if (props.allowEdit && !editing.value) {
    editing.value = true;
  }
}
</script>

<template>
  <div
    class="overflow-hidden rounded-xl border transition-[border-color,box-shadow]
      duration-200 ease-out"
    :class="[
      editing ? 'border-primary shadow-md shadow-primary/20' : 'border-transparent',
      allowEdit && !editing ? 'cursor-pointer hover:border-default' : '',
    ]"
    @click="enterEdit"
  >
    <div class="p-4">
      <div
        class="flex items-start gap-2"
        @click.stop
      >
        <h3
          v-if="!titleEditing"
          class="text-lg font-bold text-highlighted"
        >
          {{ title }}
        </h3>

        <UInput
          v-else
          ref="titleInputRef"
          v-model="titleDraft"
          variant="none"
          aria-label="编辑字段标题"
          class="w-full min-w-0"
          :ui="{ base: 'w-full p-0 text-lg font-bold text-highlighted' }"
          @keydown.enter="finishTitleEdit"
          @blur="finishTitleEdit"
        />

        <UButton
          v-if="editing && !titleEditing"
          icon="i-solar-pen-new-round-bold-duotone"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          class="shrink-0 rounded-md text-muted hover:bg-elevated hover:text-highlighted"
          aria-label="编辑标题"
          title="编辑标题"
          @click.stop="startTitleEdit()"
        />
      </div>

      <div
        v-if="description"
        class="mt-1 flex items-start gap-2"
        @click.stop
      >
        <p
          v-if="!descriptionEditing"
          class="text-sm leading-6 text-muted"
        >
          {{ description }}
        </p>

        <UTextarea
          v-else
          ref="descriptionInputRef"
          v-model="descriptionDraft"
          variant="none"
          aria-label="编辑字段描述"
          class="w-full min-w-0"
          :ui="{ base: 'w-full p-0 text-sm leading-6 text-muted' }"
          @blur="finishDescriptionEdit"
        />

        <UButton
          v-if="editing && !descriptionEditing"
          icon="i-solar-pen-new-round-bold-duotone"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          class="shrink-0 rounded-md text-muted hover:bg-elevated hover:text-highlighted"
          aria-label="编辑描述"
          title="编辑描述"
          @click.stop="startDescriptionEdit()"
        />
      </div>

      <div class="mt-3">
        <slot />
      </div>
    </div>

    <Transition name="field-edit">
      <FormFieldEditor
        v-if="editing"
        @up="emit('up')"
        @down="emit('down')"
        @duplicate="emit('duplicate')"
        @settings="emit('settings')"
        @delete="emit('delete')"
      />
    </Transition>
  </div>
</template>

<style scoped>
.field-edit-enter-active,
.field-edit-leave-active {
  transition:
    opacity 160ms ease-out,
    transform 160ms ease-out;
}

.field-edit-enter-from,
.field-edit-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .field-edit-enter-active,
  .field-edit-leave-active {
    transition: none;
  }
}
</style>
