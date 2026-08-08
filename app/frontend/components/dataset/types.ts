import type {
  CreateDatasetRowRequest,
  DatasetGroupSummary,
  DatasetOption,
  DatasetQueryKind,
  DatasetRowRange,
  DatasetFieldDefinition,
  DatasetRowData,
  DatasetSummary,
  DatasetTableQuery,
  JsonValue,
} from '@orz-people-platform/types';

export type {
  DatasetAggregateOperation,
  DatasetAggregateRule,
  DatasetFilterOperator,
  DatasetFilterRule,
  DatasetGroupRule,
  DatasetGroupSummary,
  DatasetOption,
  DatasetQueryKind,
  DatasetRowRange,
  DatasetSortRule,
  DatasetTableQuery,
  DatasetWindowQueryRequest,
  DatasetWindowQueryResponse,
} from '@orz-people-platform/types';

export interface DatasetQueryOpenRequest {
  id: number;
  kind: DatasetQueryKind;
  fieldId: string;
}

export type DatasetTableRow = DatasetRowData;

export interface DatasetWindowState {
  offset: number;
  limit: number;
  status: 'loading' | 'success' | 'error';
  error?: string;
}

export interface DatasetMetadataState {
  status: 'loading' | 'success' | 'error';
  error?: string;
}

export interface DatasetMutationState extends DatasetCellCoordinates {
  status: 'pending' | 'error' | 'conflict';
  message?: string;
}

export interface DatasetRelationOptionState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
  forbidden?: boolean;
  search?: string;
  nextCursor?: string | null;
}

export interface DatasetRelationOptionsRequest {
  fieldId: string;
  search?: string;
  cursor?: string;
  selectedIds?: string[];
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
  relationOptionStates?: Record<string, DatasetRelationOptionState>;
  rowActions?: DatasetRowAction[];
  readonlyCellKeys?: string[];
  readonlyFieldIds?: string[];
  canManageFields?: boolean;
  canCreateRows?: boolean;
  rowCreateActive?: boolean;
  rowCreatePending?: boolean;
  rowCreateError?: string | null;
  readonly?: boolean;
}

export interface DatasetTableEmits {
  'row-create-open-request': [];
  'row-create-cancel-request': [];
  'row-create-request': [input: CreateDatasetRowRequest];
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
  'relation-options-request': [request: DatasetRelationOptionsRequest];
}

export interface DatasetCellDraftState extends DatasetCellCoordinates {
  value: JsonValue;
  changed: boolean;
  valid: boolean;
}

export function getDatasetCellKey(rowId: string, fieldId: string): string {
  return `${rowId}:${fieldId}`;
}
