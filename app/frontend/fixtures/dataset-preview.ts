import type {
  DatasetFieldDefinition,
  DatasetFieldKind,
  DatasetSummary,
  JsonObject,
  JsonValue,
  RelationCardinality,
} from '@orz-people-platform/types';
import {
  applyDatasetQuery,
  getDatasetCellValue,
} from '~/components/dataset/dataset-query';
import type {
  DatasetAggregateRule,
  DatasetGroupSummary,
  DatasetOption,
  DatasetTableQuery,
  DatasetTableRow,
  DatasetWindowQueryRequest,
  DatasetWindowQueryResponse,
} from '~/components/dataset/types';

export const DATASET_PREVIEW_ROW_COUNT = 5_000;
export const DATASET_PREVIEW_FIELD_COUNT = 100;

const DATASET_ID = 'dataset-preview';
const NOW = '2026-08-03T08:00:00.000Z';

const selectOptions: DatasetOption[] = [
  { label: '待处理', value: 'pending' },
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'done' },
];

const skillOptions: DatasetOption[] = [
  { label: '产品', value: 'product' },
  { label: '设计', value: 'design' },
  { label: '前端', value: 'frontend' },
  { label: '后端', value: 'backend' },
];

const levelOptions: DatasetOption[] = [
  { label: '初级', value: 'junior' },
  { label: '中级', value: 'mid' },
  { label: '高级', value: 'senior' },
];

interface FieldFixture {
  key: string;
  name: string;
  kind: DatasetFieldKind;
  required?: boolean;
  options?: DatasetOption[];
  relationCardinality?: RelationCardinality;
  systemManaged?: boolean;
  width?: number;
}

function createValueSchema(
  kind: DatasetFieldKind,
  relationCardinality?: RelationCardinality,
): JsonObject {
  if (kind === 'number') return { type: ['number', 'null'] } as unknown as JsonObject;
  if (kind === 'boolean') return { type: 'boolean' };
  if (kind === 'multi_select' || (kind === 'relation' && relationCardinality === 'many')) {
    return { type: 'array', items: { type: 'string' } };
  }
  if (kind === 'json') return {};
  return { type: ['string', 'null'] } as unknown as JsonObject;
}

const baseFieldFixtures: FieldFixture[] = [
  {
    key: 'name', name: '姓名', kind: 'text', required: true,
  },
  {
    key: 'bio', name: '个人简介', kind: 'long_text', width: 260,
  },
  { key: 'age', name: '年龄', kind: 'number' },
  { key: 'enabled', name: '启用', kind: 'boolean' },
  { key: 'joined_date', name: '加入日期', kind: 'date' },
  { key: 'reminder_time', name: '提醒时间', kind: 'time' },
  {
    key: 'last_seen_at', name: '最近在线', kind: 'datetime', width: 220,
  },
  {
    key: 'email', name: '邮箱', kind: 'email', width: 220,
  },
  {
    key: 'homepage', name: '主页', kind: 'url', width: 240,
  },
  {
    key: 'status', name: '状态', kind: 'single_select', options: selectOptions,
  },
  {
    key: 'skills', name: '技能', kind: 'multi_select', options: skillOptions, width: 220,
  },
  {
    key: 'metadata', name: '元数据', kind: 'json', width: 260,
  },
  {
    key: 'mentor', name: '导师', kind: 'relation', relationCardinality: 'one',
  },
  {
    key: 'team_members', name: '协作成员', kind: 'relation', relationCardinality: 'many', width: 220,
  },
  { key: 'city', name: '城市', kind: 'text' },
  {
    key: 'notes', name: '备注', kind: 'long_text', width: 260,
  },
  { key: 'score', name: '评分', kind: 'number' },
  { key: 'subscribed', name: '订阅通知', kind: 'boolean' },
  { key: 'birthday', name: '生日', kind: 'date' },
  { key: 'office_time', name: '办公时间', kind: 'time' },
  {
    key: 'modified_at', name: '更新时间', kind: 'datetime', systemManaged: true, width: 220,
  },
  {
    key: 'alternate_email', name: '备用邮箱', kind: 'email', width: 220,
  },
  {
    key: 'document_url', name: '资料地址', kind: 'url', width: 240,
  },
  {
    key: 'level', name: '级别', kind: 'single_select', options: levelOptions,
  },
  {
    key: 'tags', name: '标签', kind: 'multi_select', options: skillOptions, width: 220,
  },
  {
    key: 'preferences', name: '偏好配置', kind: 'json', width: 260,
  },
  {
    key: 'owner', name: '负责人', kind: 'relation', relationCardinality: 'one',
  },
  {
    key: 'reviewers', name: '审核人', kind: 'relation', relationCardinality: 'many', width: 220,
  },
  { key: 'project', name: '项目', kind: 'text' },
  { key: 'budget', name: '预算', kind: 'number' },
];

const supplementalKinds: DatasetFieldKind[] = [
  'text',
  'number',
  'boolean',
  'date',
  'single_select',
];

const fieldFixtures: FieldFixture[] = [
  ...baseFieldFixtures,
  ...Array.from(
    { length: DATASET_PREVIEW_FIELD_COUNT - baseFieldFixtures.length },
    (_, index): FieldFixture => {
      const position = baseFieldFixtures.length + index + 1;
      const kind = supplementalKinds[index % supplementalKinds.length] ?? 'text';
      return {
        key: `extended_${position}`,
        name: `扩展字段 ${position}`,
        kind,
        ...(kind === 'single_select' ? { options: selectOptions } : {}),
      };
    },
  ),
];

export const datasetPreviewDataset: DatasetSummary = {
  id: DATASET_ID,
  workspaceId: 1,
  name: '成员数据集预览',
  slug: 'dataset-preview',
  description: 'Phase 1B 绝对窗口本地模拟数据',
  type: 'members',
  status: 'active',
  subjectMode: 'single_per_user',
  revision: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

export const datasetPreviewFields: DatasetFieldDefinition[] = fieldFixtures
  .map((fixture, index) => ({
    id: `field-${fixture.key}`,
    datasetId: DATASET_ID,
    key: fixture.key,
    name: fixture.name,
    description: null,
    kind: fixture.kind,
    valueSchema: createValueSchema(fixture.kind, fixture.relationCardinality),
    config: {
      ...(fixture.options ? { options: fixture.options as unknown as JsonValue } : {}),
      ...(fixture.width ? { width: fixture.width } : {}),
    },
    required: fixture.required ?? false,
    isSystemManaged: fixture.systemManaged ?? false,
    systemKey: fixture.systemManaged ? fixture.key : null,
    relationTargetDatasetId: fixture.kind === 'relation' ? 'dataset-members' : null,
    relationCardinality: fixture.relationCardinality ?? null,
    position: index,
    revision: 1,
    archivedAt: null,
  }));

const memberOptions: DatasetOption[] = Array.from({ length: 30 }, (_, index) => ({
  label: `成员 ${String(index + 1).padStart(2, '0')}`,
  value: `member-${index + 1}`,
}));

export const datasetPreviewRelationOptions: Record<string, DatasetOption[]> = Object.fromEntries(
  datasetPreviewFields
    .filter((field) => field.kind === 'relation')
    .map((field) => [field.id, memberOptions]),
);

function fieldValue(field: DatasetFieldDefinition, index: number): JsonValue {
  const sequence = index + 1;
  const day = String((index % 28) + 1).padStart(2, '0');
  const hour = String(index % 24).padStart(2, '0');
  const optionIndex = index % 3;

  if (field.key === 'name') return `成员 ${String(sequence).padStart(5, '0')}`;
  if (field.kind === 'long_text') return `这是第 ${sequence} 行用于验证长文本截断与编辑的模拟内容。`;
  if (field.kind === 'number') return (index * (field.position + 3)) % 10_000;
  if (field.kind === 'boolean') return index % 3 !== 0;
  if (field.kind === 'date') return `2026-${String((index % 12) + 1).padStart(2, '0')}-${day}`;
  if (field.kind === 'time') return `${hour}:${String((index * 7) % 60).padStart(2, '0')}`;
  if (field.kind === 'datetime') return `2026-08-${day}T${hour}:00`;
  if (field.kind === 'email') return `member${sequence}@example.com`;
  if (field.kind === 'url') return `https://example.com/people/${sequence}`;
  if (field.kind === 'single_select') {
    const options = field.key === 'level' ? levelOptions : selectOptions;
    return options[optionIndex]?.value ?? null;
  }
  if (field.kind === 'multi_select') {
    return [
      skillOptions[index % skillOptions.length]!.value,
      skillOptions[(index + 1) % skillOptions.length]!.value,
    ];
  }
  if (field.kind === 'json') return { sequence, source: 'preview' };
  return ['北京', '上海', '成都', '深圳'][index % 4] ?? '北京';
}

export function createDatasetPreviewRow(index: number): DatasetTableRow {
  const values: Record<string, JsonValue> = {};
  const relations: Record<string, string | string[]> = {};

  datasetPreviewFields.forEach((field) => {
    if (field.kind === 'relation') {
      relations[field.id] = field.relationCardinality === 'many'
        ? [`member-${(index % 30) + 1}`, `member-${((index + 7) % 30) + 1}`]
        : `member-${(index % 30) + 1}`;
    } else {
      values[field.id] = fieldValue(field, index);
    }
  });

  return {
    id: `row-${index + 1}`,
    datasetId: DATASET_ID,
    values,
    relations,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

export function createDatasetPreviewRows(
  count = DATASET_PREVIEW_ROW_COUNT,
  offset = 0,
): DatasetTableRow[] {
  return Array.from({ length: count }, (_, index) => createDatasetPreviewRow(index + offset));
}

export function createEmptyDatasetPreviewRow(sequence: number): DatasetTableRow {
  const values: Record<string, JsonValue> = {};
  const relations: Record<string, string | string[]> = {};
  datasetPreviewFields.forEach((field) => {
    if (field.kind === 'relation') {
      relations[field.id] = field.relationCardinality === 'many' ? [] : '';
    } else if (field.kind === 'boolean') {
      values[field.id] = false;
    } else if (field.kind === 'multi_select') {
      values[field.id] = [];
    } else {
      values[field.id] = null;
    }
  });
  values['field-name'] = `新增成员 ${sequence}`;

  return {
    id: `local-row-${sequence}`,
    datasetId: DATASET_ID,
    values,
    relations,
    revision: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 2147483647;
  }
  return hash.toString(36);
}

export function canonicalizeDatasetPreviewQuery(query: DatasetTableQuery): string {
  return JSON.stringify({
    filters: query.filters,
    sorts: query.sorts,
    group: query.group,
  });
}

export function getDatasetPreviewQueryFingerprint(query: DatasetTableQuery): string {
  return `preview-${stableHash(JSON.stringify({
    workspaceId: datasetPreviewDataset.workspaceId,
    datasetId: datasetPreviewDataset.id,
    revision: datasetPreviewDataset.revision,
    query: canonicalizeDatasetPreviewQuery(query),
  }))}`;
}

function isEmpty(value: JsonValue): boolean {
  return value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function aggregateRows(
  rows: readonly DatasetTableRow[],
  fields: readonly DatasetFieldDefinition[],
  rule: DatasetAggregateRule,
): JsonValue {
  const field = fields.find((item) => item.id === rule.fieldId);
  if (!field) return null;
  const values = rows
    .map((row) => getDatasetCellValue(row, field))
    .filter((value) => !isEmpty(value));
  if (rule.operation === 'count_non_empty') return values.length;
  if (values.length === 0) return null;

  if (field.kind === 'number') {
    const numbers = values.map(Number).filter((value) => Number.isFinite(value));
    if (numbers.length === 0) return null;
    const sum = numbers.reduce((total, value) => total + value, 0);
    if (rule.operation === 'sum') return sum;
    if (rule.operation === 'avg') return sum / numbers.length;
    return rule.operation === 'min' ? Math.min(...numbers) : Math.max(...numbers);
  }

  const strings = values.map(String).sort((left, right) => left.localeCompare(right));
  return rule.operation === 'min' ? strings[0] ?? null : strings.at(-1) ?? null;
}

function createGroupDirectory(
  rows: readonly DatasetTableRow[],
  fields: readonly DatasetFieldDefinition[],
  query: DatasetTableQuery,
): DatasetGroupSummary[] | undefined {
  const groupRule = query.group;
  if (!groupRule) return undefined;
  const field = fields.find((item) => item.id === groupRule.fieldId);
  if (!field) return [];

  const groups: Array<{
    key: JsonValue;
    startRowIndex: number;
    rows: DatasetTableRow[];
  }> = [];
  rows.forEach((row, rowIndex) => {
    const key = getDatasetCellValue(row, field);
    const previous = groups.at(-1);
    if (!previous || JSON.stringify(previous.key) !== JSON.stringify(key)) {
      groups.push({ key, startRowIndex: rowIndex, rows: [row] });
    } else {
      previous.rows.push(row);
    }
  });

  return groups.map((group) => ({
    groupId: `group-${stableHash(`${field.id}:${JSON.stringify(group.key)}`)}`,
    groupKey: group.key,
    startRowIndex: group.startRowIndex,
    rowCount: group.rows.length,
    aggregates: Object.fromEntries(groupRule.aggregates.map((rule) => [
      rule.id,
      aggregateRows(group.rows, fields, rule),
    ])),
  }));
}

function waitForMockLatency(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Query aborted', 'AbortError'));
      return;
    }
    let timeout: ReturnType<typeof setTimeout>;
    const handleAbort = () => {
      clearTimeout(timeout);
      reject(new DOMException('Query aborted', 'AbortError'));
    };
    timeout = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, 80);
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

export async function queryDatasetPreviewWindow(
  rows: readonly DatasetTableRow[],
  fields: readonly DatasetFieldDefinition[],
  request: DatasetWindowQueryRequest,
  signal: AbortSignal,
): Promise<DatasetWindowQueryResponse> {
  await waitForMockLatency(signal);
  const queriedRows = applyDatasetQuery([...rows], [...fields], request.query);
  const startIndex = Math.min(request.window.offset, queriedRows.length);
  return {
    queryFingerprint: getDatasetPreviewQueryFingerprint(request.query),
    totalRowCount: queriedRows.length,
    startIndex,
    items: queriedRows.slice(startIndex, startIndex + request.window.limit),
    ...(request.includeGroupDirectory
      ? { groups: createGroupDirectory(queriedRows, fields, request.query) }
      : {}),
  };
}
