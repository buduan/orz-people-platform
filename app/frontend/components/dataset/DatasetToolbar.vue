<script setup lang="ts">
import type { DatasetFieldDefinition } from '@orz-people-platform/types';
import { computed } from '#imports';
import DatasetQueryPopover from './DatasetQueryPopover.vue';
import type {
  DatasetOption,
  DatasetQueryOpenRequest,
  DatasetTableQuery,
} from './types';

const props = defineProps<{
  fields: DatasetFieldDefinition[];
  query: DatasetTableQuery;
  relationOptions?: Record<string, DatasetOption[]>;
  readonly?: boolean;
  openRequest?: DatasetQueryOpenRequest | null;
}>();

const emit = defineEmits<{
  createRow: [];
  updateQuery: [query: DatasetTableQuery];
}>();

const hasFilters = computed(() => props.query.filters.length > 0);
const hasSorts = computed(() => props.query.sorts.length > 0);
const hasGroup = computed(() => props.query.group !== null);

</script>

<template>
  <div
    :class="[
      'flex min-h-12 flex-wrap items-center gap-1 border-b border-slate-200',
      'bg-slate-100 px-3 py-2',
    ]"
  >
    <UButton
      icon="i-solar-add-circle-bold-duotone"
      label="新增一行"
      color="neutral"
      variant="ghost"
      size="sm"
      class="rounded-md text-slate-700 hover:bg-slate-200"
      :disabled="readonly"
      @click="emit('createRow')"
    />
    <DatasetQueryPopover
      kind="filter"
      :fields="fields"
      :query="query"
      :relation-options="relationOptions"
      :active="hasFilters"
      :open-request-id="openRequest?.kind === 'filter' ? openRequest.id : undefined"
      :requested-field-id="openRequest?.kind === 'filter' ? openRequest.fieldId : undefined"
      @apply="emit('updateQuery', $event)"
    />
    <DatasetQueryPopover
      kind="sort"
      :fields="fields"
      :query="query"
      :relation-options="relationOptions"
      :active="hasSorts"
      :open-request-id="openRequest?.kind === 'sort' ? openRequest.id : undefined"
      :requested-field-id="openRequest?.kind === 'sort' ? openRequest.fieldId : undefined"
      @apply="emit('updateQuery', $event)"
    />
    <DatasetQueryPopover
      kind="group"
      :fields="fields"
      :query="query"
      :relation-options="relationOptions"
      :active="hasGroup"
      :open-request-id="openRequest?.kind === 'group' ? openRequest.id : undefined"
      :requested-field-id="openRequest?.kind === 'group' ? openRequest.fieldId : undefined"
      @apply="emit('updateQuery', $event)"
    />
    <UButton
      icon="i-solar-clipboard-list-bold-duotone"
      label="表单"
      color="neutral"
      variant="ghost"
      size="sm"
      class="rounded-md text-slate-700 hover:bg-slate-200"
      disabled
    />
  </div>
</template>
