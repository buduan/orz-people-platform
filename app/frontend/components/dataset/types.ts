import type {
  DatasetFieldDefinition,
  DatasetRowData,
  DatasetSummary,
  JsonValue,
} from '@orz-people-platform/types';

export type DatasetQueryKind = 'filter' | 'sort' | 'group';

export interface DatasetQueryOpenRequest {
  id: number;
  kind: DatasetQueryKind;
  fieldId: string;
}

export type DatasetFilterOperator =
  | 'contains'
  | 'equals'
  | 'not_equals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_empty'
  | 'is_not_empty'
  | 'contains_any'
  | 'contains_all'
  | 'not_contains';

export interface DatasetFilterRule {
  id: string;
  fieldId: string;
  operator: DatasetFilterOperator;
  value?: JsonValue;
}

export interface DatasetSortRule {
  id: string;
  fieldId: string;
  direction: 'asc' | 'desc';
}

export type DatasetAggregateOperation =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count_non_empty';

export interface DatasetAggregateRule {
  id: string;
  fieldId: string;
  operation: DatasetAggregateOperation;
}

export interface DatasetGroupRule {
  fieldId: string;
  aggregates: DatasetAggregateRule[];
}

export interface DatasetTableQuery {
  filters: DatasetFilterRule[];
  sorts: DatasetSortRule[];
  group: DatasetGroupRule | null;
}

export type DatasetTableRow = DatasetRowData;

export interface DatasetGroupSummary {
  groupId: string;
  groupKey: JsonValue | null;
  startRowIndex: number;
  rowCount: number;
  aggregates: Record<string, JsonValue>;
}

export interface DatasetRowRange {
  startIndex: number;
  endIndex: number;
}

export interface DatasetWindowState {
  offset: number;
  limit: number;
  status: 'loading' | 'success' | 'error';
  error?: string;
}

export interface DatasetWindowQueryRequest {
  query: DatasetTableQuery;
  window: {
    offset: number;
    limit: number;
  };
  includeGroupDirectory?: boolean;
}

export interface DatasetWindowQueryResponse {
  queryFingerprint: string;
  totalRowCount: number;
  startIndex: number;
  items: DatasetTableRow[];
  groups?: DatasetGroupSummary[];
}

export interface DatasetMetadataState {
  status: 'loading' | 'success' | 'error';
  error?: string;
}

export interface DatasetMutationState extends DatasetCellCoordinates {
  status: 'pending' | 'error' | 'conflict';
  message?: string;
}

export interface DatasetOption {
  label: string;
  value: string;
}

export interface DatasetCellLockState {
  rowId: string;
  fieldId: string;
  status: 'owned' | 'remote';
  ownerName?: string;
  expiresAt?: string;
}

export interface DatasetRowAction {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}

export type DatasetFieldAction =
  | 'modify'
  | 'insert'
  | 'delete'
  | 'filter'
  | 'group'
  | 'sort';

export interface DatasetCellCoordinates {
  rowId: string;
  fieldId: string;
}

export interface DatasetCellCommitPayload extends DatasetCellCoordinates {
  value: JsonValue;
  expectedRevision: number;
}

export interface DatasetFieldActionPayload {
  fieldId: string;
  action: DatasetFieldAction;
}

export interface DatasetRowActionPayload {
  rowId: string;
  actionId: string;
  row: DatasetTableRow;
}

export interface DatasetToggleGroupPayload {
  groupId: string;
  collapsed: boolean;
}

export type DatasetSelection =
  | {
    mode: 'explicit';
    rowIds: string[];
  }
  | {
    mode: 'all_matching';
    queryFingerprint: string;
    excludedRowIds: string[];
  };

export interface DatasetVisibleRange {
  startDisplayIndex: number;
  endDisplayIndex: number;
  rowRanges: DatasetRowRange[];
  loadedRowIds: string[];
}

export interface DatasetTableProps {
  dataset: DatasetSummary;
  fields: DatasetFieldDefinition[];
  query: DatasetTableQuery;
  queryFingerprint: string;
  totalRowCount: number;
  rowSlots: Readonly<Record<number, DatasetTableRow | undefined>>;
  groupDirectory?: DatasetGroupSummary[] | null;
  collapsedGroupIds?: string[];
  metadataState?: DatasetMetadataState;
  windowStates?: DatasetWindowState[];
  mutationStates?: DatasetMutationState[];
  selection?: DatasetSelection;
  locks?: DatasetCellLockState[];
  relationOptions?: Record<string, DatasetOption[]>;
  rowActions?: DatasetRowAction[];
  readonlyCellKeys?: string[];
  readonly?: boolean;
}

export interface DatasetTableEmits {
  'row-create-request': [];
  'query-change': [query: DatasetTableQuery];
  'selection-change': [selection: DatasetSelection];
  'field-action': [payload: DatasetFieldActionPayload];
  'row-action': [payload: DatasetRowActionPayload];
  'cell-lock-acquire-request': [coordinates: DatasetCellCoordinates];
  'cell-lock-release-request': [coordinates: DatasetCellCoordinates];
  'cell-commit-request': [payload: DatasetCellCommitPayload];
  'toggle-group': [payload: DatasetToggleGroupPayload];
  'window-range-request': [ranges: DatasetRowRange[]];
  'visible-range-change': [range: DatasetVisibleRange];
}

export interface DatasetCellDraftState extends DatasetCellCoordinates {
  value: JsonValue;
  changed: boolean;
  valid: boolean;
}

export function getDatasetCellKey(rowId: string, fieldId: string): string {
  return `${rowId}:${fieldId}`;
}
