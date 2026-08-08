<script setup lang="ts">
/* eslint-disable vue/valid-v-for -- False positives for Vue template-scoped aliases. */
import type {
  CreateDatasetFieldRequest,
  CreateDatasetRowRequest,
  DatasetFieldDefinition,
  DatasetRowData,
  UpdateDatasetFieldRequest,
  UpdateDatasetRequest,
} from '@orz-people-platform/types';
import type {
  DatasetFieldActionPayload,
  DatasetRowActionPayload,
  DatasetToggleGroupPayload,
} from '~/components/dataset/types';
import { toApiError } from '~/utils/api';
import { computed, shallowRef, useRouter } from '#imports';
import { useDatasetEditor } from '~/composables/useDatasetEditor';
import {
  isDatasetEditorReadonly,
  toggleDatasetGroupId,
} from './editor-state';

type CreateFieldInput = Omit<CreateDatasetFieldRequest, 'expectedDatasetRevision'>;
type UpdateFieldInput = Omit<UpdateDatasetFieldRequest, 'expectedDatasetRevision' | 'expectedFieldRevision'>;

const props = defineProps<{ datasetId: string }>();
const router = useRouter();
const editor = useDatasetEditor(props.datasetId);
const rowCreateActive = shallowRef(false);
const rowPending = shallowRef(false);
const rowError = shallowRef<string | null>(null);
const deleteRowTarget = shallowRef<DatasetRowData | null>(null);
const fieldDialogOpen = shallowRef(false);
const fieldDialogTarget = shallowRef<DatasetFieldDefinition | null>(null);
const fieldInsertPosition = shallowRef<number | undefined>(undefined);
const fieldPending = shallowRef(false);
const fieldError = shallowRef<string | null>(null);
const archiveFieldTarget = shallowRef<DatasetFieldDefinition | null>(null);
const metadataOpen = shallowRef(false);
const metadataPending = shallowRef(false);
const metadataError = shallowRef<string | null>(null);
const archiveOpen = shallowRef(false);
const archivePending = shallowRef(false);
const archiveError = shallowRef<string | null>(null);
const actionError = shallowRef<string | null>(null);

const creatorName = computed(() => editor.detail.value?.creator.displayName ?? '加载中');
const readonly = computed(() => isDatasetEditorReadonly(
  editor.dataset.value?.status,
  editor.capabilities.value,
));
const readonlyRelationFieldIds = computed(() => Object.entries(
  editor.relationOptionStates.value,
).flatMap(([fieldId, state]) => (state.forbidden ? [fieldId] : [])));
const rowActions = computed(() => (editor.capabilities.value.canDeleteRows
  ? [{
    id: 'delete',
    label: '删除行',
    icon: 'i-solar-trash-bin-minimalistic-2-bold-duotone',
  }]
  : []));

function apiMessage(cause: unknown): string {
  const error = toApiError(cause);
  return error.httpStatus === 409 ? '数据已被其他操作更新，请重试。' : error.message;
}

function handleFieldAction(payload: DatasetFieldActionPayload): void {
  const field = editor.fields.value.find((item) => item.id === payload.fieldId);
  if (!field) return;
  if (payload.action === 'modify') {
    fieldDialogTarget.value = field;
    fieldInsertPosition.value = undefined;
    fieldError.value = null;
    fieldDialogOpen.value = true;
  } else if (payload.action === 'insert') {
    fieldDialogTarget.value = null;
    fieldInsertPosition.value = field.position + 1;
    fieldError.value = null;
    fieldDialogOpen.value = true;
  } else if (payload.action === 'delete' && !field.isSystemManaged) {
    archiveFieldTarget.value = field;
  }
}

function handleToggleGroup(payload: DatasetToggleGroupPayload): void {
  editor.setCollapsedGroupIds(toggleDatasetGroupId(
    editor.collapsedGroupIds.value,
    payload.groupId,
    payload.collapsed,
  ));
}

function handleRowAction(payload: DatasetRowActionPayload): void {
  if (payload.actionId === 'delete') deleteRowTarget.value = payload.row;
}

async function createRow(input: CreateDatasetRowRequest): Promise<void> {
  rowPending.value = true;
  rowError.value = null;
  try {
    await editor.createRow(input);
    rowCreateActive.value = false;
  } catch (cause) {
    rowError.value = apiMessage(cause);
  } finally {
    rowPending.value = false;
  }
}

function openRowCreate(): void {
  rowError.value = null;
  rowCreateActive.value = true;
}

function cancelRowCreate(): void {
  if (rowPending.value) return;
  rowError.value = null;
  rowCreateActive.value = false;
}

async function deleteRow(): Promise<void> {
  const row = deleteRowTarget.value;
  if (!row) return;
  rowPending.value = true;
  actionError.value = null;
  try {
    await editor.deleteRow(row);
    deleteRowTarget.value = null;
  } catch (cause) {
    actionError.value = apiMessage(cause);
  } finally {
    rowPending.value = false;
  }
}

async function createField(input: CreateFieldInput): Promise<void> {
  fieldPending.value = true;
  fieldError.value = null;
  try {
    await editor.createField(input);
    fieldDialogOpen.value = false;
  } catch (cause) {
    fieldError.value = apiMessage(cause);
  } finally {
    fieldPending.value = false;
  }
}

async function updateField(input: UpdateFieldInput): Promise<void> {
  const field = fieldDialogTarget.value;
  if (!field) return;
  fieldPending.value = true;
  fieldError.value = null;
  try {
    await editor.updateField(field, input);
    fieldDialogOpen.value = false;
  } catch (cause) {
    fieldError.value = apiMessage(cause);
  } finally {
    fieldPending.value = false;
  }
}

async function archiveField(): Promise<void> {
  const field = archiveFieldTarget.value;
  if (!field) return;
  fieldPending.value = true;
  actionError.value = null;
  try {
    await editor.archiveField(field);
    archiveFieldTarget.value = null;
  } catch (cause) {
    actionError.value = apiMessage(cause);
  } finally {
    fieldPending.value = false;
  }
}

async function updateMetadata(input: Omit<UpdateDatasetRequest, 'expectedRevision'>): Promise<void> {
  metadataPending.value = true;
  metadataError.value = null;
  try {
    await editor.updateMetadata(input);
    metadataOpen.value = false;
  } catch (cause) {
    metadataError.value = apiMessage(cause);
  } finally {
    metadataPending.value = false;
  }
}

async function archiveDataset(): Promise<void> {
  archivePending.value = true;
  archiveError.value = null;
  try {
    await editor.archiveDataset();
    archiveOpen.value = false;
  } catch (cause) {
    archiveError.value = apiMessage(cause);
  } finally {
    archivePending.value = false;
  }
}
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col overflow-hidden bg-default">
    <PanelDatasetEditorHeader
      class="shrink-0"
      :title="editor.dataset.value?.name ?? '加载数据表'"
      :creator-name="creatorName"
      :status="editor.dataset.value?.status ?? 'active'"
      :can-update="editor.capabilities.value.canUpdateMetadata"
      :can-archive="editor.capabilities.value.canArchive"
      :pending="archivePending || metadataPending"
      @back="router.push('/panel/dataset')"
      @update="metadataError = null; metadataOpen = true"
      @archive="archiveError = null; archiveOpen = true"
    />

    <div
      v-if="editor.detailState.value === 'loading'"
      class="grid min-h-0 flex-1 grid-rows-[3rem_1fr]"
      aria-label="正在加载数据表编辑器"
    >
      <div class="flex items-center gap-3 border-b border-default px-4">
        <USkeleton class="h-4 w-24" />
        <USkeleton class="h-4 w-20" />
      </div>
      <div class="space-y-2 p-4">
        <!-- eslint-disable-next-line vue/valid-v-for -->
        <USkeleton
          v-for="index in 8"
          :key="index"
          class="h-9 w-full"
        />
      </div>
    </div>

    <div
      v-else-if="editor.detailState.value === 'error'"
      class="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center"
      role="alert"
    >
      <UIcon
        name="i-solar-danger-triangle-bold-duotone"
        class="mb-3 size-9 text-error"
      />
      <p class="font-medium text-highlighted">
        编辑器加载失败
      </p>
      <p class="mt-1 max-w-md text-sm text-muted">
        {{ editor.detailError.value }}
      </p>
      <UButton
        label="重试"
        icon="i-solar-refresh-bold-duotone"
        color="neutral"
        variant="outline"
        class="mt-4"
        @click="editor.loadDetail"
      />
    </div>

    <DatasetTable
      v-else-if="editor.dataset.value"
      class="min-h-0 flex-1 !rounded-none !border-0"
      :dataset="editor.dataset.value"
      :fields="editor.fields.value"
      :query="editor.query.value"
      :query-fingerprint="editor.queryFingerprint.value"
      :total-row-count="editor.totalRowCount.value"
      :row-slots="editor.rowSlots.value"
      :group-directory="editor.groupDirectory.value"
      :collapsed-group-ids="editor.collapsedGroupIds.value"
      :metadata-state="editor.metadataState.value"
      :window-states="editor.windowStates.value"
      :mutation-states="editor.mutationStates.value"
      :selection="editor.selection.value"
      :locks="editor.locks.value"
      :relation-options="editor.relationOptions.value"
      :relation-option-states="editor.relationOptionStates.value"
      :row-actions="rowActions"
      :readonly="readonly"
      :can-create-rows="editor.capabilities.value.canCreateRows"
      :can-manage-fields="editor.capabilities.value.canManageFields"
      :readonly-field-ids="readonlyRelationFieldIds"
      :row-create-active="rowCreateActive"
      :row-create-pending="rowPending"
      :row-create-error="rowError"
      @row-create-open-request="openRowCreate"
      @row-create-cancel-request="cancelRowCreate"
      @row-create-request="createRow"
      @query-change="editor.updateQuery"
      @selection-change="editor.setSelection"
      @field-action="handleFieldAction"
      @row-action="handleRowAction"
      @cell-lock-acquire-request="editor.acquireLock"
      @cell-lock-release-request="editor.releaseLock"
      @cell-commit-request="editor.commitCell"
      @toggle-group="handleToggleGroup"
      @window-range-request="editor.requestRanges"
      @visible-range-change="editor.updateVisibleRange"
      @relation-options-request="editor.loadRelationOptions"
    />

    <UAlert
      v-if="actionError"
      color="error"
      variant="solid"
      title="操作失败"
      :description="actionError"
      close
      class="absolute bottom-4 left-1/2 z-20 w-[min(30rem,calc(100%-2rem))]
        -translate-x-1/2 shadow-lg"
      @update:open="actionError = null"
    />

    <PanelDatasetFieldDialog
      v-model:open="fieldDialogOpen"
      :field="fieldDialogTarget"
      :position="fieldInsertPosition"
      :pending="fieldPending"
      :error="fieldError"
      @create="createField"
      @update="updateField"
    />
    <PanelDatasetMetadataDialog
      v-if="editor.dataset.value"
      v-model:open="metadataOpen"
      :dataset="editor.dataset.value"
      :pending="metadataPending"
      :error="metadataError"
      @submit="updateMetadata"
    />

    <UModal
      :open="archiveOpen"
      title="归档数据表"
      description="归档后仍可读取，但所有修改能力会立即关闭。"
      :dismissible="!archivePending"
      @update:open="archiveOpen = $event"
    >
      <template #body>
        <UAlert
          v-if="archiveError"
          color="error"
          variant="subtle"
          title="归档失败"
          :description="archiveError"
        />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="取消"
            color="neutral"
            variant="ghost"
            :disabled="archivePending"
            @click="archiveOpen = false"
          />
          <UButton
            label="确认归档"
            color="error"
            :loading="archivePending"
            @click="archiveDataset"
          />
        </div>
      </template>
    </UModal>

    <UModal
      :open="deleteRowTarget !== null"
      title="删除这一行"
      description="删除后该行将从数据表中移除。"
      :dismissible="!rowPending"
      @update:open="!$event ? deleteRowTarget = null : undefined"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="取消"
            color="neutral"
            variant="ghost"
            :disabled="rowPending"
            @click="deleteRowTarget = null"
          />
          <UButton
            label="确认删除"
            color="error"
            :loading="rowPending"
            @click="deleteRow"
          />
        </div>
      </template>
    </UModal>

    <UModal
      :open="archiveFieldTarget !== null"
      title="删除字段"
      :description="archiveFieldTarget ? `字段“${archiveFieldTarget.name}”将被归档，历史数据仍会保留。` : ''"
      :dismissible="!fieldPending"
      @update:open="!$event ? archiveFieldTarget = null : undefined"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="取消"
            color="neutral"
            variant="ghost"
            :disabled="fieldPending"
            @click="archiveFieldTarget = null"
          />
          <UButton
            label="确认删除"
            color="error"
            :loading="fieldPending"
            @click="archiveField"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
