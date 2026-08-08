<script setup lang="ts">
/* eslint-disable vue/valid-v-for -- Form row keys use API identifiers */
import type {
  CreateFormRequest,
  CreateFormResult,
  DatasetFieldDefinition,
  DatasetPanelDetail,
  DatasetSummary,
  FormListSection,
  FormPanelSummary,
  JsonSchemaObject,
} from '@weave/types';
import { createFormItemId } from '@weave/utils';
import {
  computed,
  definePageMeta,
  onMounted,
  ref,
  shallowRef,
  useNuxtApp,
  useRouter,
  useState,
  useToast,
} from '#imports';
import { toApiError } from '~/utils/api';
import {
  defaultFormLocale,
  detectFormLocale,
  formatFormLocale,
} from '~/utils/form-locales';

definePageMeta({
  layout: 'dashboard',
  title: '表单管理',
});

const { $api } = useNuxtApp();
const router = useRouter();
const toast = useToast();
const workspaceId = useState<number>('dashboard-workspace-id', () => 1);

const forms = shallowRef<FormPanelSummary[]>([]);
const datasets = shallowRef<DatasetSummary[]>([]);
const activeSection = shallowRef<FormListSection>('main');
const loading = shallowRef(true);
const loadError = shallowRef<string | null>(null);
const createOpen = shallowRef(false);
const creating = shallowRef(false);
const createError = shallowRef<string | null>(null);
const pendingFormId = shallowRef<string | null>(null);
const createModel = ref({
  datasetId: '',
  slug: '',
  title: '',
  locale: defaultFormLocale,
});

const activeDatasets = computed(() => datasets.value.filter((dataset) => (
  dataset.status === 'active'
)));
const datasetItems = computed(() => activeDatasets.value.map((dataset) => ({
  label: dataset.name,
  value: dataset.id,
})));

function apiPath(resource: 'datasets' | 'forms', action: string): string {
  return `/workspaces/${workspaceId.value}/${resource}/${action}`;
}

async function loadForms(section = activeSection.value): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    forms.value = await $api.get<FormPanelSummary[]>(
      apiPath('forms', `listForms?status=${section}`),
    );
  } catch (error) {
    loadError.value = toApiError(error).message;
  } finally {
    loading.value = false;
  }
}

async function loadDatasets(): Promise<void> {
  try {
    datasets.value = await $api.get<DatasetSummary[]>(apiPath('datasets', 'listDatasets'));
  } catch (error) {
    toast.add({
      title: '无法载入数据集',
      description: toApiError(error).message,
      color: 'error',
    });
  }
}

async function selectSection(section: FormListSection): Promise<void> {
  if (section === activeSection.value) return;
  activeSection.value = section;
  await loadForms(section);
}

function openCreateDialog(): void {
  const browserLanguages = typeof navigator === 'undefined' ? undefined : navigator.languages;
  createModel.value = {
    datasetId: activeDatasets.value[0]?.id ?? '',
    slug: '',
    title: '',
    locale: detectFormLocale(browserLanguages),
  };
  createError.value = null;
  createOpen.value = true;
}

function widgetForField(field: DatasetFieldDefinition): string {
  if (field.kind === 'long_text') return 'textarea';
  if (field.kind === 'boolean') return 'checkbox';
  if (field.kind === 'single_select') return 'radio';
  if (field.kind === 'multi_select' || field.kind === 'relation') return 'selector';
  return 'input';
}

function initialProperty(
  field: DatasetFieldDefinition,
  locale: string,
): JsonSchemaObject {
  const valueSchema = field.valueSchema !== null
    && typeof field.valueSchema === 'object'
    && !Array.isArray(field.valueSchema)
    ? structuredClone(field.valueSchema)
    : {};
  const config = field.config as Record<string, unknown>;
  const options = field.kind === 'relation' && typeof config.labelFieldId === 'string'
    ? { labelFieldId: config.labelFieldId }
    : undefined;
  return {
    ...valueSchema,
    'x-form': {
      datasetFieldId: field.id,
      i18n: { title: { [locale]: field.name } },
      ui: {
        widget: widgetForField(field),
        ...(options && { options }),
      },
    },
  };
}

function createInitialSchema(
  dataset: DatasetPanelDetail,
  locale: string,
  title: string,
): JsonSchemaObject {
  const requiredFields = dataset.fields.filter((field) => field.required && !field.isSystemManaged);
  const entries = requiredFields.map((field) => ([
    createFormItemId(),
    field,
  ] as const));
  return {
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(entries.map(([itemId, field]) => ([
      itemId,
      initialProperty(field, locale),
    ]))),
    required: entries.map(([itemId]) => itemId),
    'x-form': {
      version: 1,
      datasetId: dataset.id,
      capture: {},
      i18n: { title: { [locale]: title } },
    },
  };
}

async function createForm(): Promise<void> {
  const {
    datasetId, locale, slug, title,
  } = createModel.value;
  if (!datasetId || !slug.trim() || !title.trim()) {
    createError.value = '请完整填写数据集、标识与表单名称。';
    return;
  }
  creating.value = true;
  createError.value = null;
  const normalizedSlug = slug.trim().toLowerCase();
  const normalizedTitle = title.trim();
  try {
    const selectedDataset = await $api.get<DatasetPanelDetail>(
      apiPath('datasets', `getDataset/${datasetId}`),
    );
    const payload: CreateFormRequest = {
      datasetId,
      slug: normalizedSlug,
      defaultLocale: locale,
      nameI18n: { [locale]: normalizedTitle },
      submissionAccess: selectedDataset.subjectMode === 'single_per_user'
        ? 'authentication_required'
        : 'anonymous_allowed',
      writeMode: 'create_row',
      schema: createInitialSchema(selectedDataset, locale, normalizedTitle),
    };
    const created = await $api.post<CreateFormResult>(apiPath('forms', 'createForm'), payload);
    createOpen.value = false;
    await router.push(`/panel/form/${created.form.id}`);
  } catch (error) {
    createError.value = toApiError(error).message;
  } finally {
    creating.value = false;
  }
}

async function changeArchiveState(form: FormPanelSummary): Promise<void> {
  pendingFormId.value = form.id;
  const action = form.status === 'archived' ? 'unarchiveForm' : 'archiveForm';
  try {
    await $api.post(apiPath('forms', action), {
      formId: form.id,
      expectedRevision: form.revision,
    });
    toast.add({ title: form.status === 'archived' ? '表单已恢复' : '表单已归档' });
    await loadForms();
  } catch (error) {
    toast.add({
      title: '操作失败',
      description: toApiError(error).message,
      color: 'error',
    });
  } finally {
    pendingFormId.value = null;
  }
}

function showRecordsPlaceholder(): void {
  toast.add({ title: '提交记录功能将在后续版本开放' });
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

onMounted(async () => {
  await Promise.all([loadForms(), loadDatasets()]);
});
</script>

<template>
  <div class="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-8 lg:px-12">
    <PanelCommonNavigation />

    <main class="mt-8">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
            表单管理
          </h1>
          <p class="mt-1.5 text-sm text-muted">
            管理基于 JSON Schema 的表单草稿与发布版本。
          </p>
        </div>
        <UButton
          label="新建表单"
          icon="i-solar-add-circle-bold-duotone"
          color="neutral"
          :disabled="activeDatasets.length === 0"
          @click="openCreateDialog"
        />
      </header>

      <div
        class="mt-8 flex gap-5 border-b border-default"
        role="tablist"
        aria-label="表单分类"
      >
        <button
          type="button"
          class="-mb-px border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors"
          :class="activeSection === 'main'
            ? 'border-current text-highlighted'
            : 'border-transparent text-muted hover:text-highlighted'"
          role="tab"
          :aria-selected="activeSection === 'main'"
          @click="selectSection('main')"
        >
          主要表单
        </button>
        <button
          type="button"
          class="-mb-px border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors"
          :class="activeSection === 'archived'
            ? 'border-current text-highlighted'
            : 'border-transparent text-muted hover:text-highlighted'"
          role="tab"
          :aria-selected="activeSection === 'archived'"
          @click="selectSection('archived')"
        >
          已归档
        </button>
      </div>

      <div
        v-if="loading"
        class="grid min-h-72 place-items-center"
      >
        <UIcon
          name="i-solar-refresh-bold-duotone"
          class="size-7 animate-spin text-primary"
        />
      </div>

      <div
        v-else-if="loadError"
        class="grid min-h-72 place-items-center p-8 text-center"
      >
        <div>
          <UIcon
            name="i-solar-danger-triangle-bold-duotone"
            class="size-8 text-error"
          />
          <p class="mt-3 text-sm text-muted">
            {{ loadError }}
          </p>
          <UButton
            class="mt-4"
            label="重试"
            color="neutral"
            @click="loadForms()"
          />
        </div>
      </div>

      <div
        v-else-if="forms.length === 0"
        class="grid min-h-72 place-items-center p-8 text-center"
      >
        <div>
          <UIcon
            name="i-solar-notes-minimalistic-bold-duotone"
            class="size-10 text-dimmed"
          />
          <h2 class="mt-3 font-medium text-highlighted">
            {{ activeSection === 'archived' ? '暂无已归档表单' : '还没有表单' }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            绑定一个数据集后即可开始设计表单。
          </p>
        </div>
      </div>

      <div
        v-else
        class="overflow-x-auto"
      >
        <table class="w-full min-w-[58rem] text-left text-sm">
          <thead class="border-b border-default text-xs font-medium text-dimmed">
            <tr>
              <th class="px-3 py-3">
                名称
              </th>
              <th class="px-3 py-3">
                标识
              </th>
              <th class="px-3 py-3">
                创建人
              </th>
              <th class="px-3 py-3">
                版本
              </th>
              <th class="px-3 py-3">
                最后更新
              </th>
              <th class="px-3 py-3 text-right">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default/70">
            <tr
              v-for="form in forms"
              :key="form.id"
              class="transition-colors hover:bg-elevated/40"
            >
              <td class="px-3 py-4">
                <p class="font-medium text-highlighted">
                  {{ form.title }}
                </p>
                <p
                  v-if="form.lock.locked"
                  class="mt-1 text-xs text-warning"
                >
                  {{ form.lock.holderName }} 正在编辑
                </p>
              </td>
              <td class="px-3 py-4 font-mono text-xs text-muted">
                {{ form.slug }}
              </td>
              <td class="px-3 py-4 text-muted">
                {{ form.creator.displayName }}
              </td>
              <td class="px-3 py-4">
                <div class="flex gap-1.5">
                  <UBadge
                    v-if="form.hasDraft"
                    label="草稿"
                    color="warning"
                    variant="subtle"
                  />
                  <UBadge
                    v-if="form.hasRelease"
                    label="已发布"
                    color="success"
                    variant="subtle"
                  />
                </div>
              </td>
              <td class="px-3 py-4 text-muted">
                {{ formatUpdatedAt(form.updatedAt) }}
              </td>
              <td class="px-3 py-4">
                <div class="flex justify-end gap-1">
                  <UButton
                    label="编辑"
                    icon="i-solar-pen-2-bold-duotone"
                    color="neutral"
                    variant="ghost"
                    :to="`/panel/form/${form.id}`"
                    :title="form.lock.locked ? `${form.lock.holderName} 正在编辑` : '编辑表单'"
                  />
                  <UButton
                    label="记录"
                    icon="i-solar-clipboard-list-bold-duotone"
                    color="neutral"
                    variant="ghost"
                    @click="showRecordsPlaceholder"
                  />
                  <UButton
                    :label="form.status === 'archived' ? '恢复' : '归档'"
                    :icon="form.status === 'archived'
                      ? 'i-solar-restart-bold-duotone'
                      : 'i-solar-archive-bold-duotone'"
                    color="neutral"
                    variant="ghost"
                    :loading="pendingFormId === form.id"
                    @click="changeArchiveState(form)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <UModal
      v-model:open="createOpen"
      title="新建表单"
      description="创建后将进入 JSON Schema 编辑器。"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="createForm"
        >
          <UFormField
            label="绑定数据集"
            required
          >
            <USelect
              v-model="createModel.datasetId"
              :items="datasetItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="表单标识"
            hint="小写字母、数字与连字符"
            required
          >
            <UInput
              v-model="createModel.slug"
              class="w-full"
              placeholder="employee-profile"
            />
          </UFormField>
          <UFormField
            label="表单名称"
            required
          >
            <UInput
              v-model="createModel.title"
              class="w-full"
              placeholder="员工信息表"
            />
          </UFormField>
          <UFormField label="默认语言">
            <UInput
              :model-value="formatFormLocale(createModel.locale)"
              disabled
              class="w-full"
            />
          </UFormField>
          <UAlert
            v-if="createError"
            :description="createError"
            color="error"
            variant="subtle"
          />
          <div class="flex justify-end gap-2 pt-2">
            <UButton
              label="取消"
              color="neutral"
              variant="ghost"
              @click="createOpen = false"
            />
            <UButton
              label="创建并编辑"
              type="submit"
              :loading="creating"
            />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
