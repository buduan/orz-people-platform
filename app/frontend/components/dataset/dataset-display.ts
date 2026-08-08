import type {
  DatasetGroupSummary,
  DatasetRowRange,
} from './types';

export const DATASET_ROW_HEIGHT = 44;
export const DATASET_GROUP_HEADER_HEIGHT = 56;

export type DatasetDisplayItem =
  | {
    key: string;
    kind: 'group';
    groupIndex: number;
  }
  | {
    key: string;
    kind: 'row';
    rowIndex: number;
  };

export function validateDatasetGroupDirectory(
  totalRowCount: number,
  groups: readonly DatasetGroupSummary[],
): string | null {
  if (!Number.isInteger(totalRowCount) || totalRowCount < 0) {
    return '数据行总数必须是非负整数';
  }

  const groupIds = new Set<string>();
  let nextStartIndex = 0;
  let directoryError: string | null = null;
  groups.some((group) => {
    if (groupIds.has(group.groupId)) {
      directoryError = `分组 ID 重复：${group.groupId}`;
      return true;
    }
    if (!Number.isInteger(group.startRowIndex) || group.startRowIndex !== nextStartIndex) {
      directoryError = `分组 ${group.groupId} 的起始索引不连续`;
      return true;
    }
    if (!Number.isInteger(group.rowCount) || group.rowCount <= 0) {
      directoryError = `分组 ${group.groupId} 的行数必须是正整数`;
      return true;
    }
    groupIds.add(group.groupId);
    nextStartIndex += group.rowCount;
    return false;
  });

  if (directoryError) return directoryError;

  return nextStartIndex === totalRowCount
    ? null
    : `分组行数 ${nextStartIndex} 与总行数 ${totalRowCount} 不一致`;
}

export function buildDatasetDisplayItems(
  totalRowCount: number,
  groups: readonly DatasetGroupSummary[] | null,
  collapsedGroupIds: ReadonlySet<string>,
): DatasetDisplayItem[] {
  if (groups === null) {
    return Array.from({ length: totalRowCount }, (_, rowIndex) => ({
      key: `row:${rowIndex}`,
      kind: 'row' as const,
      rowIndex,
    }));
  }

  const error = validateDatasetGroupDirectory(totalRowCount, groups);
  if (error) throw new RangeError(error);

  const items: DatasetDisplayItem[] = [];
  groups.forEach((group, groupIndex) => {
    items.push({
      key: `group:${group.groupId}`,
      kind: 'group',
      groupIndex,
    });
    if (collapsedGroupIds.has(group.groupId)) return;
    for (let index = 0; index < group.rowCount; index += 1) {
      const rowIndex = group.startRowIndex + index;
      items.push({ key: `row:${rowIndex}`, kind: 'row', rowIndex });
    }
  });
  return items;
}

export function getDatasetDisplayItemSize(item: DatasetDisplayItem): number {
  return item.kind === 'group' ? DATASET_GROUP_HEADER_HEIGHT : DATASET_ROW_HEIGHT;
}

export function getDatasetDisplayItemOffset(
  items: readonly DatasetDisplayItem[],
  itemIndex: number,
): number {
  let offset = 0;
  for (let index = 0; index < itemIndex; index += 1) {
    const item = items[index];
    if (item) offset += getDatasetDisplayItemSize(item);
  }
  return offset;
}

export function getDatasetRowRanges(
  items: readonly DatasetDisplayItem[],
): DatasetRowRange[] {
  return items.reduce<DatasetRowRange[]>((ranges, item) => {
    if (item.kind !== 'row') return ranges;
    const last = ranges.at(-1);
    if (last && last.endIndex + 1 === item.rowIndex) {
      last.endIndex = item.rowIndex;
    } else {
      ranges.push({ startIndex: item.rowIndex, endIndex: item.rowIndex });
    }
    return ranges;
  }, []);
}
