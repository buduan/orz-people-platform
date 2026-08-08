import type { DatasetRowRange } from './types';

export const DATASET_WINDOW_SIZE = 50;

export interface DatasetWindowQueryScope {
  workspaceId: number | string;
  datasetId: string;
  definitionRevision: number;
}

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
