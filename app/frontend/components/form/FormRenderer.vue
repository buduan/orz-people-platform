<script setup lang="ts">
/* eslint-disable vue/valid-v-for -- FormField keys use schema item ids */
import {
  computed,
  onBeforeUnmount,
  onMounted,
  provide,
  useTemplateRef,
  watch,
} from '#imports';
import type { FormItemId, JsonSchema, JsonValue } from '@orz-people-platform/types';
import { createInitialFormState, getSchemaProperties } from '@orz-people-platform/utils';
import { useFormFieldEditingState } from '~/composables/useFormFieldEditing';
import type { FormRenderContext, FormRenderMode } from './types';

const props = withDefaults(defineProps<{
  schema: JsonSchema;
  mode?: FormRenderMode;
  locale?: string;
  defaultLocale?: string;
}>(), {
  mode: 'fill',
  locale: 'zh-CN',
  defaultLocale: 'zh-CN',
});

const state = defineModel<Record<FormItemId, JsonValue | undefined>>({
  default: () => ({}),
});
const selectedFieldId = defineModel<string | null>('selectedFieldId', {
  default: null,
});
const formRoot = useTemplateRef<{ $el: HTMLElement }>('formRoot');

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

const properties = computed(() => getSchemaProperties(props.schema));

const formContext = computed<FormRenderContext>(() => ({
  defaultLocale: props.defaultLocale,
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

function onDocumentClick(event: MouseEvent): void {
  const form = formRoot.value?.$el;
  if (
    props.mode !== 'edit'
    || !form
    || !(event.target instanceof Node)
    || form.contains(event.target)
  ) return;
  clearEditing();
}

onMounted(() => document.addEventListener('click', onDocumentClick, true));
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick, true));

function onSubmit(): void {
  emit('submit', state.value);
}
</script>

<template>
  <UForm
    ref="formRoot"
    :state="state"
    class="space-y-4"
    @submit="onSubmit"
    @click.self="onBlankClick"
  >
    <FormField
      v-for="(_, itemId) in properties ?? {}"
      :key="itemId"
      :field-id="itemId"
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
