<script setup lang="ts">
/* eslint-disable vue/valid-v-for -- Form item keys are stable Schema ids */
import type { editor as MonacoEditor } from 'monaco-editor';
import { useIntervalFn } from '@vueuse/core';
import type {
  AcquireFormEditLockResult,
  CreateDatasetFieldRequest,
  DatasetFieldDefinition,
  DatasetPanelDetail,
  FormDraftDefinitionInput,
  FormPanelDetail,
  FormVersionDefinition,
  JsonSchemaObject,
} from '@orz-people-platform/types';
import {
  createFormItemId,
  resolveLocalizedText,
} from '@orz-people-platform/utils';
import {
  computed,
  definePageMeta,
  nextTick,
  onBeforeRouteLeave,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useNuxtApp,
  useRoute,
  useRouter,
  useState,
  useTemplateRef,
  useToast,
  watch,
} from '#imports';
import {
  createWidgetProperty,
  formWidgetDefinitions,
  type FormWidgetDefinition,
} from '~/components/form/component-map';
import { toApiError } from '~/utils/api';
import {
  addFormLocale,
  collectFormLocales,
  parseAndValidateFormSource,
  setChoiceLocalizedTitle,
  setFieldLocalizedText,
  setFormTitle,
} from '~/utils/form-editor-schema';

definePageMeta({
  layout: 'dashboard',
  title: '表单编辑',
});

interface EditableDefinition extends FormDraftDefinitionInput {
  revision: number;
  schemaChecksum: string;
}

const { $api } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const workspaceId = useState<number>('dashboard-workspace-id', () => 1);
const formId = computed(() => String(route.params.id));

const detail = ref<FormPanelDetail | null>(null);
const definition = ref<EditableDefinition | null>(null);
const dataset = ref<DatasetPanelDetail | null>(null);
const selectedFieldId = shallowRef<string | null>(null);
const activeLocale = shallowRef('zh-CN');
const loading = shallowRef(true);
const pageError = shallowRef<string | null>(null);
const mutationError = shallowRef<string | null>(null);
const dirty = shallowRef(false);
const saving = shallowRef(false);
const publishing = shallowRef(false);
const ownsLock = shallowRef(false);
const lockToken = shallowRef<string | null>(null);
const lockMessage = shallowRef('正在连接编辑会话');

const sourceOpen = shallowRef(false);
const sourceText = shallowRef('');
const sourceError = shallowRef<string | null>(null);
const monacoLoading = shallowRef(false);
const monacoHost = useTemplateRef<HTMLDivElement>('monacoHost');
const monacoEditor = shallowRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
const monacoModel = shallowRef<MonacoEditor.ITextModel | null>(null);

const schema = computed(() => definition.value?.schema ?? null);
const hasFields = computed(() => {
  const value = schema.value?.properties;
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
});
const locales = computed(() => (definition.value ? collectFormLocales(definition.value) : []));
const formTitle = computed(() => definition.value?.nameI18n[activeLocale.value] ?? '');
const displayTitle = computed(() => (definition.value
  ? resolveLocalizedText(
    definition.value.nameI18n,
    activeLocale.value,
    definition.value.defaultLocale,
  ) ?? detail.value?.slug ?? '未命名表单'
  : '未命名表单'));
const mutationsDisabled = computed(() => (
  loading.value || !ownsLock.value || detail.value?.status === 'archived'
));

function apiPath(resource: 'datasets' | 'forms', action: string): string {
  return `/workspaces/${workspaceId.value}/${resource}/${action}`;
}

function cloneDefinition(version: FormVersionDefinition): EditableDefinition {
  if (version.schema === null || typeof version.schema !== 'object' || Array.isArray(version.schema)) {
    throw new TypeError('Form Schema must be an object');
  }
  return {
    defaultLocale: version.defaultLocale,
    nameI18n: structuredClone(version.nameI18n),
    ...(version.descriptionI18n && {
      descriptionI18n: structuredClone(version.descriptionI18n),
    }),
    ...(version.closingMessageI18n && {
      closingMessageI18n: structuredClone(version.closingMessageI18n),
    }),
    ...(version.opensAt && { opensAt: version.opensAt }),
    ...(version.closesAt && { closesAt: version.closesAt }),
    submissionAccess: version.submissionAccess,
    writeMode: version.writeMode,
    schema: structuredClone(version.schema),
    revision: version.revision,
    schemaChecksum: version.schemaChecksum,
  };
}

async function initializeEditor(): Promise<void> {
  loading.value = true;
  pageError.value = null;
  try {
    const loaded = await $api.get<FormPanelDetail>(apiPath('forms', `getForm/${formId.value}`));
    const baseline = loaded.draft ?? loaded.release;
    if (!baseline) throw new TypeError('表单缺少可编辑版本。');
    detail.value = loaded;
    definition.value = cloneDefinition(baseline);
    activeLocale.value = baseline.defaultLocale;
    const schemaProperties = definition.value.schema.properties as
      Record<string, unknown> | undefined;
    selectedFieldId.value = Object.keys(schemaProperties ?? {})[0] ?? null;
    dataset.value = await $api.get<DatasetPanelDetail>(
      apiPath('datasets', `getDataset/${loaded.datasetId}`),
    );
    if (loaded.status === 'archived') {
      lockMessage.value = '已归档，只读';
      return;
    }
    try {
      const acquired = await $api.post<AcquireFormEditLockResult>(
        apiPath('forms', 'acquireFormEditLock'),
        { formId: formId.value },
      );
      lockToken.value = acquired.token;
      ownsLock.value = true;
      lockMessage.value = '独占编辑中';
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      resumeHeartbeat();
    } catch (error) {
      lockMessage.value = toApiError(error).message;
    }
  } catch (error) {
    pageError.value = toApiError(error).message;
  } finally {
    loading.value = false;
  }
}

async function heartbeat(): Promise<void> {
  const token = lockToken.value;
  if (!token) return;
  try {
    await $api.post(apiPath('forms', 'heartbeatFormEditLock'), {
      formId: formId.value,
      token,
    });
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    pauseHeartbeat();
    lockToken.value = null;
    ownsLock.value = false;
    lockMessage.value = toApiError(error).message;
    mutationError.value = '编辑锁已失效。请返回列表后重新进入，当前未保存内容仍保留在本页。';
  }
}

const {
  pause: pauseHeartbeat,
  resume: resumeHeartbeat,
} = useIntervalFn(heartbeat, 30_000, { immediate: false });

async function releaseLock(keepalive = false): Promise<void> {
  const token = lockToken.value;
  if (!token) return;
  lockToken.value = null;
  ownsLock.value = false;
  pauseHeartbeat();
  try {
    await $api.post(
      apiPath('forms', 'releaseFormEditLock'),
      { formId: formId.value, token },
      { keepalive },
    );
  } catch {
    // TTL 是释放失败时的最终兜底，不阻塞离开页面。
  }
}

function onBeforeWindowUnload(): void {
  releaseLock(true).catch(() => undefined);
}

function markMutation(action: () => void): void {
  if (mutationsDisabled.value || !definition.value) return;
  action();
  dirty.value = true;
  mutationError.value = null;
}

function properties(): Record<string, JsonSchemaObject> {
  if (!definition.value) return {};
  const current = definition.value.schema.properties;
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    definition.value.schema.properties = {};
  }
  return definition.value.schema.properties as Record<string, JsonSchemaObject>;
}

function addWidget(widgetName: string): void {
  const widget = formWidgetDefinitions.find((entry) => entry.widget === widgetName);
  if (!widget || !definition.value) return;
  markMutation(() => {
    const fieldId = createFormItemId();
    const entries = Object.entries(properties());
    const selectedIndex = entries.findIndex(([id]) => id === selectedFieldId.value);
    entries.splice(selectedIndex < 0 ? entries.length : selectedIndex + 1, 0, [
      fieldId,
      createWidgetProperty(
        widget.widget as FormWidgetDefinition['widget'],
        activeLocale.value,
        widget.label,
      ),
    ]);
    definition.value!.schema.properties = Object.fromEntries(entries);
    selectedFieldId.value = fieldId;
  });
}

function moveField(fieldId: string, offset: -1 | 1): void {
  markMutation(() => {
    const entries = Object.entries(properties());
    const from = entries.findIndex(([id]) => id === fieldId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= entries.length) return;
    const [entry] = entries.splice(from, 1);
    if (entry) entries.splice(to, 0, entry);
    definition.value!.schema.properties = Object.fromEntries(entries);
  });
}

function duplicateField(fieldId: string): void {
  markMutation(() => {
    const entries = Object.entries(properties());
    const index = entries.findIndex(([id]) => id === fieldId);
    if (index < 0) return;
    const source = entries[index]?.[1];
    if (!source) return;
    const nextId = createFormItemId();
    const cloned = structuredClone(source);
    entries.splice(index + 1, 0, [nextId, cloned]);
    definition.value!.schema.properties = Object.fromEntries(entries);
    selectedFieldId.value = nextId;
  });
}

function deleteField(fieldId: string): void {
  markMutation(() => {
    const next = { ...properties() };
    delete next[fieldId];
    definition.value!.schema.properties = next;
    if (Array.isArray(definition.value!.schema.required)) {
      definition.value!.schema.required = definition.value!.schema.required
        .filter((id) => id !== fieldId);
    }
    selectedFieldId.value = Object.keys(next)[0] ?? null;
  });
}

function updateFormTitle(value: string): void {
  markMutation(() => setFormTitle(definition.value!, activeLocale.value, value));
}

function updateFieldText(key: 'description' | 'placeholder' | 'title', value: string): void {
  const fieldId = selectedFieldId.value;
  if (!fieldId) return;
  markMutation(() => setFieldLocalizedText(
    definition.value!.schema,
    fieldId,
    key,
    activeLocale.value,
    value,
  ));
}

function updateChoiceTitle(index: number, value: string): void {
  const fieldId = selectedFieldId.value;
  if (!fieldId) return;
  markMutation(() => setChoiceLocalizedTitle(
    definition.value!.schema,
    fieldId,
    index,
    activeLocale.value,
    value,
  ));
}

function updateDatasetFieldId(value: string): void {
  const fieldId = selectedFieldId.value;
  if (!fieldId) return;
  markMutation(() => {
    const extension = properties()[fieldId]?.['x-form'] as Record<string, unknown> | undefined;
    if (extension) extension.datasetFieldId = value;
  });
}

function addLocale(locale: string): void {
  markMutation(() => addFormLocale(definition.value!, locale));
  activeLocale.value = locale;
}

async function createDatasetField(request: CreateDatasetFieldRequest): Promise<void> {
  try {
    const field = await $api.post<DatasetFieldDefinition>(
      apiPath('datasets', 'createDatasetField'),
      request,
    );
    if (dataset.value) dataset.value.fields = [...dataset.value.fields, field];
    updateDatasetFieldId(field.id);
    toast.add({ title: '数据集字段已创建并绑定' });
  } catch (error) {
    mutationError.value = toApiError(error).message;
  }
}

function savePayload(schemaOverride?: JsonSchemaObject): FormDraftDefinitionInput & {
  expectedRevision: number;
  formId: string;
  lockToken: string;
} {
  if (!definition.value || !lockToken.value) throw new TypeError('编辑锁不可用');
  const current = definition.value;
  return {
    defaultLocale: current.defaultLocale,
    nameI18n: current.nameI18n,
    ...(current.descriptionI18n && { descriptionI18n: current.descriptionI18n }),
    ...(current.closingMessageI18n && {
      closingMessageI18n: current.closingMessageI18n,
    }),
    ...(current.opensAt && { opensAt: current.opensAt }),
    ...(current.closesAt && { closesAt: current.closesAt }),
    submissionAccess: current.submissionAccess,
    writeMode: current.writeMode,
    schema: schemaOverride ?? current.schema,
    formId: formId.value,
    expectedRevision: current.revision,
    lockToken: lockToken.value,
  };
}

async function saveDraft(schemaOverride?: JsonSchemaObject): Promise<boolean> {
  if (mutationsDisabled.value || !definition.value) return false;
  saving.value = true;
  mutationError.value = null;
  try {
    const saved = await $api.post<FormVersionDefinition>(
      apiPath('forms', 'saveFormDraft'),
      savePayload(schemaOverride),
    );
    definition.value = cloneDefinition(saved);
    dirty.value = false;
    toast.add({ title: '草稿已保存' });
    return true;
  } catch (error) {
    mutationError.value = toApiError(error).message;
    return false;
  } finally {
    saving.value = false;
  }
}

async function publishForm(): Promise<void> {
  if (mutationsDisabled.value || !definition.value || !lockToken.value) return;
  if (dirty.value && !await saveDraft()) return;
  publishing.value = true;
  mutationError.value = null;
  try {
    const published = await $api.post<FormVersionDefinition>(
      apiPath('forms', 'publishForm'),
      {
        formId: formId.value,
        expectedRevision: definition.value.revision,
        lockToken: lockToken.value,
      },
    );
    definition.value = cloneDefinition(published);
    dirty.value = false;
    try {
      detail.value = await $api.get<FormPanelDetail>(
        apiPath('forms', `getForm/${formId.value}`),
      );
    } catch {
      // 发布结果已由服务端返回；详情投影可在下次进入页面时重新读取。
    }
    toast.add({ title: '表单已发布', color: 'success' });
  } catch (error) {
    mutationError.value = toApiError(error).message;
  } finally {
    publishing.value = false;
  }
}

function disposeMonaco(): void {
  monacoEditor.value?.dispose();
  monacoModel.value?.dispose();
  monacoEditor.value = null;
  monacoModel.value = null;
}

async function openSource(): Promise<void> {
  if (mutationsDisabled.value || !definition.value) return;
  sourceText.value = JSON.stringify(definition.value.schema, null, 2);
  sourceError.value = null;
  sourceOpen.value = true;
}

watch(sourceOpen, async (open) => {
  if (!open) {
    disposeMonaco();
    return;
  }
  if (!import.meta.client) return;
  monacoLoading.value = true;
  await nextTick();
  try {
    const monaco = await import('monaco-editor');
    if (!sourceOpen.value || !monacoHost.value) return;
    const model = monaco.editor.createModel(sourceText.value, 'json');
    const instance = monaco.editor.create(monacoHost.value, {
      model,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      tabSize: 2,
      scrollBeyondLastLine: false,
      theme: 'vs-dark',
    });
    model.onDidChangeContent(() => {
      sourceText.value = model.getValue();
    });
    monacoModel.value = model;
    monacoEditor.value = instance;
  } catch (error) {
    sourceError.value = `源码编辑器载入失败：${toApiError(error).message}`;
  } finally {
    monacoLoading.value = false;
  }
});

async function validateAndSaveSource(): Promise<void> {
  sourceError.value = null;
  let parsed: JsonSchemaObject;
  try {
    parsed = parseAndValidateFormSource(sourceText.value);
  } catch (error) {
    sourceError.value = error instanceof Error ? error.message : String(error);
    return;
  }
  if (!await saveDraft(parsed)) {
    sourceError.value = mutationError.value;
    return;
  }
  sourceOpen.value = false;
}

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeWindowUnload);
  initializeEditor().catch(() => undefined);
});

onBeforeRouteLeave(async () => {
  await releaseLock();
  return true;
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeWindowUnload);
  pauseHeartbeat();
  disposeMonaco();
  releaseLock().catch(() => undefined);
});
</script>

<template>
  <div class="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden lg:h-[100dvh]">
    <PanelFormEditorHeader
      class="shrink-0"
      :title="displayTitle"
      :creator-name="detail?.creator.displayName"
      :dirty="dirty"
      :disabled="mutationsDisabled"
      :lock-label="lockMessage"
      :saving="saving"
      :publishing="publishing"
      @back="router.push('/panel/form')"
      @source="openSource"
      @save="saveDraft()"
      @publish="publishForm"
    />

    <div
      v-if="loading"
      class="grid min-h-0 flex-1 place-items-center bg-muted"
    >
      <UIcon
        name="i-solar-refresh-bold-duotone"
        class="size-8 animate-spin text-primary"
      />
    </div>

    <div
      v-else-if="pageError || !definition || !schema"
      class="grid min-h-0 flex-1 place-items-center p-8"
    >
      <div class="max-w-md text-center">
        <UIcon
          name="i-solar-danger-triangle-bold-duotone"
          class="size-10 text-error"
        />
        <p class="mt-3 text-sm text-muted">
          {{ pageError ?? '无法读取表单定义。' }}
        </p>
        <UButton
          class="mt-4"
          label="返回表单列表"
          to="/panel/form"
          color="neutral"
        />
      </div>
    </div>

    <div
      v-else
      class="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto
        lg:grid-cols-[15rem_minmax(24rem,1fr)_20rem] lg:overflow-hidden"
    >
      <aside
        class="min-w-0 border-b border-default bg-default lg:min-h-0 lg:overflow-y-auto
          lg:border-b-0 lg:border-r"
      >
        <PanelFormPalette
          :disabled="mutationsDisabled"
          @add="addWidget"
        />
      </aside>

      <section
        aria-label="表单画布"
        class="min-w-0 bg-muted p-4 lg:min-h-0 lg:overflow-y-auto lg:p-8"
      >
        <div class="mx-auto max-w-2xl space-y-4">
          <UAlert
            v-if="mutationError"
            title="本次更改尚未保存"
            :description="mutationError"
            color="error"
            variant="subtle"
          />
          <UAlert
            v-else-if="mutationsDisabled"
            title="当前为只读模式"
            :description="lockMessage"
            color="warning"
            variant="subtle"
          />
          <div class="rounded-2xl border border-default bg-default p-4 shadow-sm sm:p-6">
            <div
              v-if="!hasFields"
              class="py-12 text-center"
            >
              <UIcon
                name="i-solar-add-square-bold-duotone"
                class="size-10 text-dimmed"
              />
              <p class="mt-3 text-sm text-muted">
                从左侧调色盘添加第一个表单项。
              </p>
            </div>
            <FormRenderer
              v-else
              v-model:selected-field-id="selectedFieldId"
              :schema="schema"
              :locale="activeLocale"
              :default-locale="definition.defaultLocale"
              mode="edit"
              @up="moveField($event, -1)"
              @down="moveField($event, 1)"
              @duplicate="duplicateField"
              @settings="selectedFieldId = $event"
              @delete="deleteField"
              @update:title="(id, value) => {
                selectedFieldId = id;
                updateFieldText('title', value);
              }"
              @update:description="(id, value) => {
                selectedFieldId = id;
                updateFieldText('description', value ?? '');
              }"
            />
          </div>
        </div>
      </section>

      <aside
        class="min-w-0 border-t border-default bg-default lg:min-h-0 lg:overflow-y-auto
          lg:border-l lg:border-t-0"
      >
        <PanelFormSettings
          :active-locale="activeLocale"
          :default-locale="definition.defaultLocale"
          :locales="locales"
          :form-title="formTitle"
          :schema="schema"
          :dataset="dataset"
          :selected-field-id="selectedFieldId"
          :disabled="mutationsDisabled"
          @update:active-locale="activeLocale = $event"
          @update:form-title="updateFormTitle"
          @update:field-title="updateFieldText('title', $event)"
          @update:field-description="updateFieldText('description', $event)"
          @update:field-placeholder="updateFieldText('placeholder', $event)"
          @update:dataset-field-id="updateDatasetFieldId"
          @update:choice-title="updateChoiceTitle"
          @add-locale="addLocale"
          @create-field="createDatasetField"
        />
      </aside>
    </div>

    <UModal
      v-model:open="sourceOpen"
      title="编辑表单 JSON Schema"
      description="验证通过后，将通过与 Header 保存相同的草稿接口推送完整 Schema。"
      :dismissible="!saving"
      :ui="{ content: 'sm:max-w-5xl' }"
    >
      <template #body>
        <div class="space-y-4">
          <div class="relative h-[min(65dvh,44rem)] overflow-hidden rounded-xl bg-slate-950">
            <div
              ref="monacoHost"
              class="absolute inset-0"
            />
            <div
              v-if="monacoLoading"
              class="absolute inset-0 grid place-items-center bg-slate-950"
            >
              <UIcon
                name="i-solar-refresh-bold-duotone"
                class="size-7 animate-spin text-primary"
              />
            </div>
          </div>
          <UAlert
            v-if="sourceError"
            title="Schema 尚未保存"
            :description="sourceError"
            color="error"
            variant="subtle"
          />
          <div class="flex justify-end gap-2">
            <UButton
              label="取消"
              color="neutral"
              variant="ghost"
              :disabled="saving"
              @click="sourceOpen = false"
            />
            <UButton
              label="验证并保存"
              icon="i-solar-shield-check-bold-duotone"
              :loading="saving"
              @click="validateAndSaveSource"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
