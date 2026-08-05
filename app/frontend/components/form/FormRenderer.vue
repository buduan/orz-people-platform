<script setup lang="ts">
/* eslint-disable vue/valid-v-for -- layout node keys use schema ids */
import { computed, provide, watch } from '#imports';
import type { FormItemId, JsonSchema, JsonValue } from '@orz-people-platform/types';
import { createInitialFormState, getRootExtension } from '@orz-people-platform/utils';
import { useFormFieldEditingState } from '~/composables/useFormFieldEditing';
import type { FormRenderContext, FormRenderMode } from './types';

const props = withDefaults(defineProps<{
  schema: JsonSchema;
  mode?: FormRenderMode;
  locale?: string;
}>(), {
  mode: 'fill',
  locale: 'zh-CN',
});

const state = defineModel<Record<FormItemId, JsonValue | undefined>>({
  default: () => ({}),
});
const selectedFieldId = defineModel<string | null>('selectedFieldId', {
  default: null,
});

const emit = defineEmits<{
  up: [fieldId: string];
  down: [fieldId: string];
  duplicate: [fieldId: string];
  settings: [fieldId: string];
  delete: [fieldId: string];
  'update:title': [fieldId: string, value: string];
  'update:description': [fieldId: string, value?: string];
  submit: [state: Record<FormItemId, JsonValue | undefined>];
}>();

const { selectedFieldId: activeEditingId, clearEditing } = useFormFieldEditingState();

const rootExtension = computed(() => getRootExtension(props.schema));
const layout = computed(() => rootExtension.value?.layout ?? []);

const formContext = computed<FormRenderContext>(() => ({
  locale: props.locale,
  mode: props.mode,
  schema: props.schema,
  state: state.value,
}));

provide('formRenderContext', formContext);

/** 首次挂载时若 state 为空，用 schema default 初始化。 */
watch(
  () => props.schema,
  (schema) => {
    if (Object.keys(state.value).length > 0) return;
    state.value = createInitialFormState(schema);
  },
  { immediate: true },
);

watch(activeEditingId, (id) => {
  if (selectedFieldId.value !== id) selectedFieldId.value = id;
});

watch(selectedFieldId, (id) => {
  if (id === null && activeEditingId.value !== null) clearEditing();
});

watch(
  () => props.mode,
  (mode) => {
    if (mode === 'fill') clearEditing();
  },
);

const allowEdit = computed(() => props.mode === 'edit');

function onBlankClick(): void {
  if (props.mode === 'edit') clearEditing();
}

function onSubmit(): void {
  emit('submit', state.value);
}
</script>

<template>
  <UForm
    :state="state"
    class="space-y-4"
    @submit="onSubmit"
    @click.self="onBlankClick"
  >
    <FormField
      v-for="node in layout"
      :key="node.id"
      :field-id="node.id"
      :layout-node="node"
      :allow-edit="allowEdit"
      @up="emit('up', $event)"
      @down="emit('down', $event)"
      @duplicate="emit('duplicate', $event)"
      @settings="emit('settings', $event)"
      @delete="emit('delete', $event)"
      @update:title="(id, value) => emit('update:title', id, value)"
      @update:description="(id, value) => emit('update:description', id, value)"
    />

    <slot
      name="actions"
      :state="state"
      :selected-field-id="selectedFieldId"
    />
  </UForm>
</template>
