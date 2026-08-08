import type {
  DatasetRowRange,
  DatasetRowData,
  DatasetWindowQueryScope,
} from '@weave/types';

export type { DatasetWindowQueryScope } from '@weave/types';

export const DATASET_WINDOW_SIZE = 50;

export function getDatasetWindowOffsets(
  ranges: readonly DatasetRowRange[],
  totalRowCount: number,
  prefetchAdjacent = true,
): number[] {
  const offsets = new Set<number>();
  ranges.forEach((range) => {
    const startIndex = Math.max(0, range.startIndex);
    const endIndex = Math.min(range.endIndex, Math.max(0, totalRowCount - 1));
    if (endIndex < startIndex) return;
    const firstOffset = Math.floor(startIndex / DATASET_WINDOW_SIZE) * DATASET_WINDOW_SIZE;
    const lastOffset = Math.floor(endIndex / DATASET_WINDOW_SIZE) * DATASET_WINDOW_SIZE;
    for (let offset = firstOffset; offset <= lastOffset; offset += DATASET_WINDOW_SIZE) {
      offsets.add(offset);
    }
  });

  const planned = [...offsets].sort((left, right) => left - right);
  if (!prefetchAdjacent || planned.length === 0) return planned;
  const adjacentOffset = planned.at(-1)! + DATASET_WINDOW_SIZE;
  if (adjacentOffset < totalRowCount) offsets.add(adjacentOffset);
  return [...offsets].sort((left, right) => left - right);
}

export function getDatasetWindowQueryKey(
  scope: DatasetWindowQueryScope,
  canonicalQuery: string,
  offset: number,
): readonly [string, number | string, string, number, string, number, number] {
  return [
    'dataset-window',
    scope.workspaceId,
    scope.datasetId,
    scope.definitionRevision,
    canonicalQuery,
    offset,
    DATASET_WINDOW_SIZE,
  ] as const;
}

export function replaceLoadedDatasetRow(
  rowSlots: Readonly<Record<number, DatasetRowData | undefined>>,
  row: DatasetRowData,
): Record<number, DatasetRowData | undefined> | null {
  const entry = Object.entries(rowSlots).find(([, loadedRow]) => loadedRow?.id === row.id);
  return entry ? { ...rowSlots, [Number(entry[0])]: row } : null;
}
