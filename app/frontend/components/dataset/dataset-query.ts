import type {
  DatasetFieldDefinition,
  DatasetFieldKind,
  JsonValue,
} from '@orz-people-platform/types';
import type {
  DatasetAggregateOperation,
  DatasetFilterOperator,
  DatasetFilterRule,
  DatasetOption,
  DatasetTableQuery,
  DatasetTableRow,
} from './types';

export interface DatasetFilterOperatorOption {
  label: string;
  value: DatasetFilterOperator;
  requiresValue: boolean;
}

const EMPTY_OPERATORS: DatasetFilterOperatorOption[] = [
  { label: '为空', value: 'is_empty', requiresValue: false },
  { label: '不为空', value: 'is_not_empty', requiresValue: false },
];

const TEXT_OPERATORS: DatasetFilterOperatorOption[] = [
  { label: '包含', value: 'contains', requiresValue: true },
  { label: '等于', value: 'equals', requiresValue: true },
  { label: '不等于', value: 'not_equals', requiresValue: true },
  ...EMPTY_OPERATORS,
];

const ORDERED_OPERATORS: DatasetFilterOperatorOption[] = [
  { label: '等于', value: 'equals', requiresValue: true },
  { label: '不等于', value: 'not_equals', requiresValue: true },
  { label: '大于', value: 'gt', requiresValue: true },
  { label: '大于等于', value: 'gte', requiresValue: true },
  { label: '小于', value: 'lt', requiresValue: true },
  { label: '小于等于', value: 'lte', requiresValue: true },
  ...EMPTY_OPERATORS,
];

const SINGLE_VALUE_OPERATORS: DatasetFilterOperatorOption[] = [
  { label: '等于', value: 'equals', requiresValue: true },
  { label: '不等于', value: 'not_equals', requiresValue: true },
  ...EMPTY_OPERATORS,
];

const MULTI_VALUE_OPERATORS: DatasetFilterOperatorOption[] = [
  { label: '包含任一', value: 'contains_any', requiresValue: true },
  { label: '包含全部', value: 'contains_all', requiresValue: true },
  { label: '不包含', value: 'not_contains', requiresValue: true },
  ...EMPTY_OPERATORS,
];

export const EMPTY_DATASET_QUERY: DatasetTableQuery = {
  filters: [],
  sorts: [],
  group: null,
};

export function cloneDatasetQuery(query: DatasetTableQuery): DatasetTableQuery {
  return structuredClone(query);
}

export function getDatasetFilterOperators(
  field: DatasetFieldDefinition,
): DatasetFilterOperatorOption[] {
  if (field.kind === 'boolean') {
    return [{ label: '等于', value: 'equals', requiresValue: true }];
  }

  if (['number', 'date', 'time', 'datetime'].includes(field.kind)) {
    return ORDERED_OPERATORS;
  }

  if (field.kind === 'multi_select'
    || (field.kind === 'relation' && field.relationCardinality === 'many')) {
    return MULTI_VALUE_OPERATORS;
  }

  if (field.kind === 'single_select' || field.kind === 'relation') {
    return SINGLE_VALUE_OPERATORS;
  }

  return TEXT_OPERATORS;
}

export function getDatasetFieldOptions(
  field: DatasetFieldDefinition,
  relationOptions: Record<string, DatasetOption[]> = {},
): DatasetOption[] {
  if (field.kind === 'relation') {
    return relationOptions[field.id] ?? [];
  }

  const rawOptions = field.config.options;
  if (!Array.isArray(rawOptions)) {
    return [];
  }

  return rawOptions.flatMap((option): DatasetOption[] => {
    if (typeof option === 'string') {
      return [{ label: option, value: option }];
    }

    if (typeof option === 'object' && option !== null && !Array.isArray(option)) {
      const { value } = option;
      const { label } = option;
      if (typeof value === 'string') {
        return [{ label: typeof label === 'string' ? label : value, value }];
      }
    }

    return [];
  });
}

export function isDatasetFieldGroupable(field: DatasetFieldDefinition): boolean {
  return field.kind !== 'long_text'
    && field.kind !== 'multi_select'
    && field.kind !== 'json'
    && !(field.kind === 'relation' && field.relationCardinality === 'many');
}

export function getDatasetAggregateOperations(
  field: DatasetFieldDefinition,
): DatasetAggregateOperation[] {
  if (field.kind === 'number') {
    return ['sum', 'avg', 'min', 'max', 'count_non_empty'];
  }

  if (field.kind === 'date' || field.kind === 'time' || field.kind === 'datetime') {
    return ['min', 'max', 'count_non_empty'];
  }

  if (isDatasetFieldGroupable(field)) {
    return ['count_non_empty'];
  }

  return [];
}

export function getDatasetCellValue(
  row: DatasetTableRow,
  field: DatasetFieldDefinition,
): JsonValue {
  if (field.kind === 'relation') {
    return row.relations[field.id] ?? null;
  }

  return row.values[field.id] ?? null;
}

function isEmptyValue(value: JsonValue): boolean {
  if (value === null || value === '') {
    return true;
  }

  return Array.isArray(value) && value.length === 0;
}

function normalizeComparableValue(value: JsonValue, kind: DatasetFieldKind): number | string {
  if (kind === 'number') {
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(numberValue) ? Number.NEGATIVE_INFINITY : numberValue;
  }

  if (kind === 'boolean') {
    return value === true ? 1 : 0;
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  return String(value ?? '').toLocaleLowerCase();
}

function asStringArray(value: JsonValue | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  return value === undefined || value === null || value === '' ? [] : [String(value)];
}

function matchesFilter(
  row: DatasetTableRow,
  field: DatasetFieldDefinition,
  rule: DatasetFilterRule,
): boolean {
  const cellValue = getDatasetCellValue(row, field);
  const filterValue = rule.value ?? null;

  if (rule.operator === 'is_empty') {
    return isEmptyValue(cellValue);
  }

  if (rule.operator === 'is_not_empty') {
    return !isEmptyValue(cellValue);
  }

  if (rule.operator === 'contains_any'
    || rule.operator === 'contains_all'
    || rule.operator === 'not_contains') {
    const cellValues = asStringArray(cellValue);
    const filterValues = asStringArray(rule.value);
    const hasAny = filterValues.some((value) => cellValues.includes(value));
    const hasAll = filterValues.every((value) => cellValues.includes(value));

    if (rule.operator === 'contains_any') return hasAny;
    if (rule.operator === 'contains_all') return hasAll;
    return !hasAny;
  }

  const left = normalizeComparableValue(cellValue, field.kind);
  const right = normalizeComparableValue(filterValue, field.kind);

  if (rule.operator === 'contains') {
    return String(left).includes(String(right));
  }

  if (rule.operator === 'equals') return left === right;
  if (rule.operator === 'not_equals') return left !== right;
  if (rule.operator === 'gt') return left > right;
  if (rule.operator === 'gte') return left >= right;
  if (rule.operator === 'lt') return left < right;
  if (rule.operator === 'lte') return left <= right;

  return true;
}

function compareValues(
  left: JsonValue,
  right: JsonValue,
  kind: DatasetFieldKind,
): number {
  const leftEmpty = isEmptyValue(left);
  const rightEmpty = isEmptyValue(right);
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  const normalizedLeft = normalizeComparableValue(left, kind);
  const normalizedRight = normalizeComparableValue(right, kind);
  if (typeof normalizedLeft === 'number' && typeof normalizedRight === 'number') {
    return normalizedLeft - normalizedRight;
  }

  return String(normalizedLeft).localeCompare(String(normalizedRight), 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function formatDatasetCellValue(value: JsonValue): string {
  if (value === null || value === '') return '';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.map((item) => String(item)).join('、');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function applyDatasetQuery(
  rows: DatasetTableRow[],
  fields: DatasetFieldDefinition[],
  query: DatasetTableQuery,
): DatasetTableRow[] {
  if (query.filters.length === 0 && query.sorts.length === 0 && !query.group) {
    return rows;
  }

  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const filteredRows = rows.filter((row) => query.filters.every((rule) => {
    const field = fieldsById.get(rule.fieldId);
    return field ? matchesFilter(row, field, rule) : true;
  }));
  const groupField = query.group ? fieldsById.get(query.group.fieldId) : undefined;

  return filteredRows
    .map((row, index) => ({ row, index }))
    .sort((leftEntry, rightEntry) => {
      if (groupField) {
        const grouped = compareValues(
          getDatasetCellValue(leftEntry.row, groupField),
          getDatasetCellValue(rightEntry.row, groupField),
          groupField.kind,
        );
        if (grouped !== 0) return grouped;
      }

      const sorted = query.sorts.reduce((result, rule) => {
        if (result !== 0) return result;
        const field = fieldsById.get(rule.fieldId);
        if (!field) return result;
        const compared = compareValues(
          getDatasetCellValue(leftEntry.row, field),
          getDatasetCellValue(rightEntry.row, field),
          field.kind,
        );
        return rule.direction === 'asc' ? compared : -compared;
      }, 0);
      if (sorted !== 0) return sorted;

      return leftEntry.index - rightEntry.index;
    })
    .map(({ row }) => row);
}
