<script setup lang="ts">
import type { JsonValue } from '@orz-people-platform/types';
import { shallowRef } from '#imports';
import DatasetGrid from './DatasetGrid.vue';
import DatasetToolbar from './DatasetToolbar.vue';
import DatasetViewTabs from './DatasetViewTabs.vue';
import type {
  DatasetCellCoordinates,
  DatasetFieldActionPayload,
  DatasetQueryOpenRequest,
  DatasetTableEmits,
  DatasetTableProps,
} from './types';

const QUERY_POPOVER_OPEN_DELAY = 150;

withDefaults(defineProps<DatasetTableProps>(), {
  collapsedGroupIds: () => [],
  metadataState: () => ({ status: 'success' }),
  windowStates: () => [],
  mutationStates: () => [],
  selection: () => ({ mode: 'explicit', rowIds: [] }),
  locks: () => [],
  relationOptions: () => ({}),
  rowActions: () => [],
  readonlyCellKeys: () => [],
  readonly: false,
});

const emit = defineEmits<DatasetTableEmits>();

const queryOpenRequest = shallowRef<DatasetQueryOpenRequest | null>(null);
let queryOpenRequestId = 0;

function handleFieldAction(payload: DatasetFieldActionPayload): void {
  if (payload.action === 'filter' || payload.action === 'sort' || payload.action === 'group') {
    const queryKind = payload.action;
    setTimeout(() => {
      queryOpenRequestId += 1;
      queryOpenRequest.value = {
        id: queryOpenRequestId,
        kind: queryKind,
        fieldId: payload.fieldId,
      };
    }, QUERY_POPOVER_OPEN_DELAY);
    return;
  }
  emit('field-action', payload);
}

function emitCellCommit(payload: DatasetCellCoordinates & {
  value: JsonValue;
  expectedRevision: number;
}): void {
  emit('cell-commit-request', payload);
}
</script>

<template>
  <section
    :class="[
      'flex h-full min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-lg',
      'border border-slate-200 bg-white',
    ]"
    :aria-label="`${dataset.name}数据表`"
  >
    <DatasetViewTabs />
    <DatasetToolbar
      :fields="fields"
      :query="query"
      :relation-options="relationOptions"
      :readonly="readonly"
      :open-request="queryOpenRequest"
      @create-row="emit('row-create-request')"
      @update-query="emit('query-change', $event)"
    />
    <DatasetGrid
      :fields="fields"
      :query="query"
      :query-fingerprint="queryFingerprint"
      :total-row-count="totalRowCount"
      :row-slots="rowSlots"
      :group-directory="groupDirectory"
      :collapsed-group-ids="collapsedGroupIds"
      :metadata-state="metadataState"
      :window-states="windowStates"
      :mutation-states="mutationStates"
      :selection="selection"
      :locks="locks"
      :relation-options="relationOptions"
      :row-actions="rowActions"
      :readonly-cell-keys="readonlyCellKeys"
      :readonly="readonly"
      @selection-change="emit('selection-change', $event)"
      @field-action="handleFieldAction"
      @row-action="emit('row-action', $event)"
      @cell-lock-acquire-request="emit('cell-lock-acquire-request', $event)"
      @cell-lock-release-request="emit('cell-lock-release-request', $event)"
      @cell-commit-request="emitCellCommit"
      @toggle-group="emit('toggle-group', $event)"
      @window-range-request="emit('window-range-request', $event)"
      @visible-range-change="emit('visible-range-change', $event)"
    />
  </section>
</template>
