<script setup lang="ts">
/* eslint-disable vue/valid-v-for -- Choice keys use immutable const values */
import type {
  CreateDatasetPanelFieldRequest,
  DatasetFieldKind,
  DatasetPanelDetail,
  JsonSchemaObject,
} from '@weave/types';
import { computed, ref, shallowRef } from '#imports';
import {
  canonicalizeFormLocale,
  formatFormLocale,
  orderFormLocales,
} from '~/utils/form-locales';

const props = withDefaults(defineProps<{
  activeLocale: string;
  dataset?: DatasetPanelDetail | null;
  defaultLocale: string;
  disabled?: boolean;
  formTitle: string;
  locales: string[];
  schema: JsonSchemaObject;
  selectedFieldId?: string | null;
}>(), {
  dataset: null,
  disabled: false,
  selectedFieldId: null,
});

const emit = defineEmits<{
  'update:activeLocale': [locale: string];
  'update:formTitle': [value: string];
  'update:fieldTitle': [value: string];
  'update:fieldDescription': [value: string];
  'update:fieldPlaceholder': [value: string];
  'update:datasetFieldId': [value: string];
  'update:choiceTitle': [index: number, value: string];
  addLocale: [locale: string];
  createField: [request: CreateDatasetPanelFieldRequest];
}>();

const localeDraft = shallowRef('');
const localeError = shallowRef<string | null>(null);
const createFieldOpen = shallowRef(false);
const createFieldError = shallowRef<string | null>(null);
const createFieldModel = ref<{
  key: string;
  kind: DatasetFieldKind;
  name: string;
}>({
  key: '',
  kind: 'text',
  name: '',
});

const localeItems = computed(() => orderFormLocales(props.defaultLocale, props.locales)
  .map((locale) => ({
    label: formatFormLocale(locale),
    value: locale,
  })));

const properties = computed(() => (
  props.schema.properties as Record<string, JsonSchemaObject> | undefined
) ?? {});
const selectedProperty = computed(() => (
  props.selectedFieldId ? properties.value[props.selectedFieldId] ?? null : null
));
const selectedExtension = computed(() => (
  selectedProperty.value?.['x-form'] as Record<string, unknown> | undefined
));
const selectedI18n = computed(() => (
  selectedExtension.value?.i18n as Record<string, Record<string, string>> | undefined
));
const fieldTitle = computed(() => selectedI18n.value?.title?.[props.activeLocale] ?? '');
const fieldDescription = computed(() => (
  selectedI18n.value?.description?.[props.activeLocale] ?? ''
));
const fieldPlaceholder = computed(() => (
  selectedI18n.value?.placeholder?.[props.activeLocale] ?? ''
));
const datasetFieldId = computed(() => (
  typeof selectedExtension.value?.datasetFieldId === 'string'
    ? selectedExtension.value.datasetFieldId
    : ''
));
const datasetFieldItems = computed(() => (props.dataset?.fields ?? []).map((field) => ({
  label: `${field.name} · ${field.key}`,
  value: field.id,
})));
const choices = computed(() => (
  Array.isArray(selectedProperty.value?.oneOf)
    ? selectedProperty.value.oneOf as JsonSchemaObject[]
    : []
));
const fieldKindItems: Array<{ label: string; value: DatasetFieldKind }> = [
  { label: '单行文本', value: 'text' },
  { label: '多行文本', value: 'long_text' },
  { label: '数字', value: 'number' },
  { label: '布尔值', value: 'boolean' },
  { label: '单选', value: 'single_select' },
  { label: '多选', value: 'multi_select' },
];

function choiceTitle(choice: JsonSchemaObject): string {
  const extension = choice['x-form'] as Record<string, unknown> | undefined;
  const i18n = extension?.i18n as Record<string, Record<string, string>> | undefined;
  return i18n?.title?.[props.activeLocale] ?? '';
}

function addLocale(): void {
  const locale = canonicalizeFormLocale(localeDraft.value);
  if (!locale) {
    localeError.value = '请输入有效的 BCP 47 语言标识，例如 en-US。';
    return;
  }
  if (props.locales.includes(locale)) {
    localeError.value = '该语言已存在。';
    return;
  }
  emit('addLocale', locale);
  localeDraft.value = '';
  localeError.value = null;
}

function openCreateField(): void {
  createFieldModel.value = { key: '', kind: 'text', name: '' };
  createFieldError.value = null;
  createFieldOpen.value = true;
}

function submitCreateField(): void {
  if (!props.dataset || !createFieldModel.value.key.trim() || !createFieldModel.value.name.trim()) {
    createFieldError.value = '请填写字段名称与 key。';
    return;
  }
  const { key, kind, name } = createFieldModel.value;
  let valueSchema: JsonSchemaObject = { type: 'string' };
  if (kind === 'number') valueSchema = { type: 'number' };
  if (kind === 'boolean') valueSchema = { type: 'boolean' };
  emit('createField', {
    datasetId: props.dataset.id,
    key: key.trim(),
    name: name.trim(),
    kind,
    valueSchema,
    config: {},
    required: false,
  });
  createFieldOpen.value = false;
}
</script>

<template>
  <div class="h-full space-y-6 p-4">
    <section class="space-y-3">
      <div>
        <h2 class="text-sm font-semibold text-highlighted">
          表单语言
        </h2>
        <p class="mt-1 text-xs leading-5 text-muted">
          默认语言固定排在第一位，其他语言可独立编辑。
        </p>
      </div>
      <UFormField label="当前编辑语言">
        <USelect
          :model-value="activeLocale"
          :items="localeItems"
          value-key="value"
          class="w-full"
          :disabled="disabled"
          @update:model-value="emit('update:activeLocale', $event)"
        />
      </UFormField>
      <div class="flex gap-2">
        <UInput
          v-model="localeDraft"
          class="min-w-0 flex-1"
          placeholder="en-US"
          :disabled="disabled"
          @keydown.enter.prevent="addLocale"
        />
        <UButton
          label="新增"
          icon="i-solar-add-circle-linear"
          color="neutral"
          variant="outline"
          :disabled="disabled"
          @click="addLocale"
        />
      </div>
      <p
        v-if="localeError"
        class="text-xs text-error"
      >
        {{ localeError }}
      </p>
    </section>

    <section class="space-y-3 border-t border-default pt-5">
      <h2 class="text-sm font-semibold text-highlighted">
        表单设置
      </h2>
      <UFormField :label="`表单名称 · ${activeLocale}`">
        <UInput
          :model-value="formTitle"
          class="w-full"
          :disabled="disabled"
          @update:model-value="emit('update:formTitle', $event)"
        />
      </UFormField>
    </section>

    <section class="space-y-3 border-t border-default pt-5">
      <div>
        <h2 class="text-sm font-semibold text-highlighted">
          表单项设置
        </h2>
        <p
          v-if="!selectedProperty"
          class="mt-1 text-xs leading-5 text-muted"
        >
          在画布中选择一个表单项后可编辑其翻译与字段绑定。
        </p>
      </div>

      <template v-if="selectedProperty">
        <UFormField :label="`标题 · ${activeLocale}`">
          <UInput
            :model-value="fieldTitle"
            class="w-full"
            :disabled="disabled"
            @update:model-value="emit('update:fieldTitle', $event)"
          />
        </UFormField>
        <UFormField :label="`描述 · ${activeLocale}`">
          <UTextarea
            :model-value="fieldDescription"
            class="w-full"
            :disabled="disabled"
            @update:model-value="emit('update:fieldDescription', $event)"
          />
        </UFormField>
        <UFormField :label="`占位文案 · ${activeLocale}`">
          <UInput
            :model-value="fieldPlaceholder"
            class="w-full"
            :disabled="disabled"
            @update:model-value="emit('update:fieldPlaceholder', $event)"
          />
        </UFormField>

        <UFormField label="数据集字段">
          <USelect
            :model-value="datasetFieldId"
            :items="datasetFieldItems"
            value-key="value"
            class="w-full"
            placeholder="选择字段"
            :disabled="disabled"
            @update:model-value="emit('update:datasetFieldId', $event)"
          />
        </UFormField>
        <UButton
          label="创建数据集字段"
          icon="i-solar-add-square-bold-duotone"
          color="neutral"
          variant="outline"
          block
          :disabled="disabled || !dataset"
          @click="openCreateField"
        />

        <div
          v-if="choices.length"
          class="space-y-2 pt-2"
        >
          <h3 class="text-xs font-medium text-muted">
            选项文案 · {{ activeLocale }}
          </h3>
          <UFormField
            v-for="(choice, index) in choices"
            :key="String(choice.const)"
            :label="String(choice.const)"
          >
            <UInput
              :model-value="choiceTitle(choice)"
              class="w-full"
              :disabled="disabled"
              @update:model-value="emit('update:choiceTitle', index, $event)"
            />
          </UFormField>
        </div>
      </template>
    </section>

    <UModal
      v-model:open="createFieldOpen"
      title="创建数据集字段"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="submitCreateField"
        >
          <UFormField
            label="字段名称"
            required
          >
            <UInput
              v-model="createFieldModel.name"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="字段 key"
            required
          >
            <UInput
              v-model="createFieldModel.key"
              class="w-full"
              placeholder="employee_name"
            />
          </UFormField>
          <UFormField label="字段类型">
            <USelect
              v-model="createFieldModel.kind"
              :items="fieldKindItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UAlert
            v-if="createFieldError"
            :description="createFieldError"
            color="error"
            variant="subtle"
          />
          <div class="flex justify-end gap-2">
            <UButton
              label="取消"
              color="neutral"
              variant="ghost"
              @click="createFieldOpen = false"
            />
            <UButton
              label="创建并绑定"
              type="submit"
            />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
