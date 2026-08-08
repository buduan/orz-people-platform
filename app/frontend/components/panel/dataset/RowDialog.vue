<script setup lang="ts">
/* eslint-disable vue/valid-v-for -- False positives for Vue template-scoped aliases. */
import type {
  CreateDatasetRowRequest,
  DatasetFieldDefinition,
  DatasetOption,
  JsonValue,
} from '@orz-people-platform/types';
import {
  getDatasetFieldOptions,
  parseDatasetFieldInputValue,
} from '@orz-people-platform/utils';
import { reactive, watch } from '#imports';

const props = withDefaults(defineProps<{
  open: boolean;
  fields: DatasetFieldDefinition[];
  relationOptions?: Record<string, DatasetOption[]>;
  pending?: boolean;
  error?: string | null;
}>(), {
  relationOptions: () => ({}),
  pending: false,
  error: null,
});

const emit = defineEmits<{
  'update:open': [open: boolean];
  'relation-options-request': [fieldId: string];
  submit: [input: CreateDatasetRowRequest];
}>();

const drafts = reactive<Record<string, unknown>>({});
const errors = reactive<Record<string, string>>({});

watch(() => props.open, (open) => {
  if (!open) return;
  props.fields.forEach((field) => {
    if (drafts[field.id] !== undefined) return;
    if (field.kind === 'boolean') drafts[field.id] = false;
    else if (field.kind === 'multi_select'
      || (field.kind === 'relation' && field.relationCardinality === 'many')) {
      drafts[field.id] = [];
    } else drafts[field.id] = '';
  });
});

function inputType(field: DatasetFieldDefinition): string {
  if (field.kind === 'number') return 'number';
  if (field.kind === 'date') return 'date';
  if (field.kind === 'time') return 'time';
  if (field.kind === 'datetime') return 'datetime-local';
  if (field.kind === 'email') return 'email';
  if (field.kind === 'url') return 'url';
  return 'text';
}

function options(field: DatasetFieldDefinition): DatasetOption[] {
  return getDatasetFieldOptions(field, props.relationOptions);
}

function isChoiceField(field: DatasetFieldDefinition): boolean {
  return field.kind === 'single_select'
    || field.kind === 'multi_select'
    || field.kind === 'relation';
}

function selectValue(fieldId: string): string | string[] {
  const value = drafts[fieldId];
  return Array.isArray(value) ? value.map(String) : String(value ?? '');
}

function handleSelectOpen(open: boolean, field: DatasetFieldDefinition): void {
  if (open && field.kind === 'relation') emit('relation-options-request', field.id);
}

function submit(): void {
  const values: Record<string, JsonValue> = {};
  const relations: Record<string, string | string[]> = {};
  let valid = true;
  props.fields.forEach((field) => {
    const parsed = parseDatasetFieldInputValue(field, drafts[field.id]);
    errors[field.id] = '';
    if (!parsed.valid) {
      errors[field.id] = field.kind === 'json' ? '请输入有效 JSON' : '此字段为必填项';
    }
    if (!parsed.valid) {
      valid = false;
      return;
    }
    if (parsed.value === null || parsed.value === ''
      || (Array.isArray(parsed.value) && parsed.value.length === 0)) return;
    if (field.kind === 'relation') {
      relations[field.id] = parsed.value as string | string[];
    } else {
      values[field.id] = parsed.value;
    }
  });
  if (valid) emit('submit', { values, relations });
}
</script>

<template>
  <UModal
    :open="open"
    title="新增一行"
    description="填写数据表中的可写字段。"
    :dismissible="!pending"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form
        id="dataset-row-form"
        class="max-h-[65dvh] space-y-4 overflow-y-auto px-0.5"
        @submit.prevent="submit"
      >
        <!-- eslint-disable-next-line vue/valid-v-for -->
        <UFormField
          v-for="field in fields"
          :key="field.id"
          :label="field.name"
          :required="field.required"
          :description="field.description ?? undefined"
          :error="errors[field.id]"
        >
          <UCheckbox
            v-if="field.kind === 'boolean'"
            :model-value="drafts[field.id] === true"
            label="是"
            @update:model-value="drafts[field.id] = $event === true"
          />
          <UTextarea
            v-else-if="field.kind === 'long_text' || field.kind === 'json'"
            :model-value="String(drafts[field.id] ?? '')"
            class="w-full"
            :rows="field.kind === 'json' ? 4 : 3"
            @update:model-value="drafts[field.id] = $event"
          />
          <USelect
            v-else-if="isChoiceField(field)"
            :model-value="selectValue(field.id)"
            :items="options(field)"
            value-key="value"
            :multiple="field.kind === 'multi_select' || field.relationCardinality === 'many'"
            class="w-full"
            @update:open="handleSelectOpen($event, field)"
            @update:model-value="drafts[field.id] = $event"
          />
          <UInput
            v-else
            :model-value="String(drafts[field.id] ?? '')"
            :type="inputType(field)"
            class="w-full"
            @update:model-value="drafts[field.id] = $event"
          />
        </UFormField>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          title="新增失败"
          :description="error"
        />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="取消"
          color="neutral"
          variant="ghost"
          :disabled="pending"
          @click="emit('update:open', false)"
        />
        <UButton
          form="dataset-row-form"
          type="submit"
          label="新增行"
          :loading="pending"
        />
      </div>
    </template>
  </UModal>
</template>
