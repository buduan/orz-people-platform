import { useQueryClient } from '@tanstack/vue-query';
import type {
  DatasetGroupSummary,
  DatasetRowRange,
  DatasetTableQuery,
  DatasetWindowQueryRequest,
  DatasetWindowQueryResponse,
  DatasetWindowQueryScope,
} from '@weave/types';
import type {
  DatasetMetadataState,
  DatasetTableRow,
  DatasetWindowState,
} from '~/components/dataset/types';
import {
  DATASET_WINDOW_SIZE,
  getDatasetWindowOffsets,
  getDatasetWindowQueryKey,
  replaceLoadedDatasetRow,
} from '~/components/dataset/dataset-window';
import {
  computed,
  shallowReadonly,
  shallowRef,
  toValue,
  watch,
} from '#imports';
import type { MaybeRefOrGetter } from '#imports';

const MAX_RETAINED_WINDOWS = 6;

export interface UseDatasetWindowQueryOptions {
  scope: MaybeRefOrGetter<DatasetWindowQueryScope>;
  query: MaybeRefOrGetter<DatasetTableQuery>;
  canonicalQuery: MaybeRefOrGetter<string>;
  queryFingerprint: MaybeRefOrGetter<string>;
  activeRowIndex?: MaybeRefOrGetter<number | null>;
  fetchWindow: (
    request: DatasetWindowQueryRequest,
    signal: AbortSignal,
  ) => Promise<DatasetWindowQueryResponse>;
}

export function useDatasetWindowQuery(options: UseDatasetWindowQueryOptions) {
  const queryClient = useQueryClient();
  const rowSlots = shallowRef<Record<number, DatasetTableRow | undefined>>({});
  const totalRowCount = shallowRef(0);
  const groupDirectory = shallowRef<DatasetGroupSummary[] | null | undefined>(undefined);
  const metadataState = shallowRef<DatasetMetadataState>({ status: 'loading' });
  const windowStates = shallowRef<DatasetWindowState[]>([]);
  const retainedOffsets = shallowRef<number[]>([]);

  const namespaceKey = computed(() => JSON.stringify([
    toValue(options.scope),
    toValue(options.canonicalQuery),
  ]));

  function setWindowState(nextState: DatasetWindowState): void {
    windowStates.value = [
      ...windowStates.value.filter((state) => state.offset !== nextState.offset),
      nextState,
    ].sort((left, right) => left.offset - right.offset);
  }

  function removeWindow(offset: number): void {
    const scope = toValue(options.scope);
    const queryKey = getDatasetWindowQueryKey(
      scope,
      toValue(options.canonicalQuery),
      offset,
    );
    queryClient.removeQueries({ queryKey, exact: true });
    const nextSlots = { ...rowSlots.value };
    for (let index = offset; index < offset + DATASET_WINDOW_SIZE; index += 1) {
      delete nextSlots[index];
    }
    rowSlots.value = nextSlots;
    windowStates.value = windowStates.value.filter((state) => state.offset !== offset);
  }

  function retainWindows(requestedOffsets: readonly number[]): void {
    const activeRowIndex = options.activeRowIndex === undefined
      ? null
      : toValue(options.activeRowIndex);
    const activeOffset = activeRowIndex === null
      ? null
      : Math.floor(activeRowIndex / DATASET_WINDOW_SIZE) * DATASET_WINDOW_SIZE;
    const nextOffsets = [...new Set([
      ...retainedOffsets.value,
      ...requestedOffsets,
      ...(activeOffset === null ? [] : [activeOffset]),
    ])];
    const keep = new Set(nextOffsets.slice(-MAX_RETAINED_WINDOWS));
    if (activeOffset !== null) keep.add(activeOffset);
    retainedOffsets.value
      .filter((offset) => !keep.has(offset))
      .forEach(removeWindow);
    retainedOffsets.value = nextOffsets.filter((offset) => keep.has(offset));
  }

  async function fetchOffset(offset: number, includeGroupDirectory: boolean): Promise<void> {
    const scope = toValue(options.scope);
    const canonicalQuery = toValue(options.canonicalQuery);
    const expectedFingerprint = toValue(options.queryFingerprint);
    const queryKey = getDatasetWindowQueryKey(scope, canonicalQuery, offset);
    setWindowState({ offset, limit: DATASET_WINDOW_SIZE, status: 'loading' });
    if (includeGroupDirectory) metadataState.value = { status: 'loading' };

    try {
      const response = await queryClient.fetchQuery({
        queryKey,
        queryFn: ({ signal }) => options.fetchWindow({
          query: structuredClone(toValue(options.query)),
          window: { offset, limit: DATASET_WINDOW_SIZE },
          ...(includeGroupDirectory ? { includeGroupDirectory: true } : {}),
        }, signal),
      });
      if (response.queryFingerprint !== expectedFingerprint
        || expectedFingerprint !== toValue(options.queryFingerprint)) return;

      const nextSlots = { ...rowSlots.value };
      response.items.forEach((row, index) => {
        nextSlots[response.startIndex + index] = row;
      });
      rowSlots.value = nextSlots;
      totalRowCount.value = response.totalRowCount;
      if (includeGroupDirectory) {
        groupDirectory.value = toValue(options.query).group
          ? response.groups ?? []
          : null;
        metadataState.value = { status: 'success' };
      }
      setWindowState({ offset, limit: DATASET_WINDOW_SIZE, status: 'success' });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : '窗口加载失败';
      setWindowState({
        offset,
        limit: DATASET_WINDOW_SIZE,
        status: 'error',
        error: message,
      });
      if (includeGroupDirectory) metadataState.value = { status: 'error', error: message };
    }
  }

  async function requestRanges(
    ranges: readonly DatasetRowRange[],
    includeGroupDirectory = false,
  ): Promise<void> {
    const total = Math.max(totalRowCount.value, DATASET_WINDOW_SIZE);
    const offsets = getDatasetWindowOffsets(ranges, total);
    retainWindows(offsets);
    await Promise.all(offsets.map((offset, index) => fetchOffset(
      offset,
      includeGroupDirectory && index === 0,
    )));
  }

  function replaceRow(row: DatasetTableRow): boolean {
    const nextSlots = replaceLoadedDatasetRow(rowSlots.value, row);
    if (!nextSlots) return false;
    rowSlots.value = nextSlots;
    return true;
  }

  async function refreshRanges(ranges: readonly DatasetRowRange[]): Promise<void> {
    const total = Math.max(totalRowCount.value, DATASET_WINDOW_SIZE);
    const offsets = getDatasetWindowOffsets(ranges, total, false);
    const scope = toValue(options.scope);
    const canonicalQuery = toValue(options.canonicalQuery);
    await Promise.all(offsets.map((offset) => queryClient.invalidateQueries({
      queryKey: getDatasetWindowQueryKey(scope, canonicalQuery, offset),
      exact: true,
    })));
    await requestRanges(ranges, true);
  }

  async function reset(): Promise<void> {
    const scope = toValue(options.scope);
    const cancellation = queryClient.cancelQueries({
      queryKey: ['dataset-window', scope.workspaceId, scope.datasetId],
    });
    rowSlots.value = {};
    totalRowCount.value = 0;
    groupDirectory.value = undefined;
    metadataState.value = { status: 'loading' };
    windowStates.value = [];
    retainedOffsets.value = [];
    await cancellation;
    await requestRanges([{ startIndex: 0, endIndex: DATASET_WINDOW_SIZE - 1 }], true);
  }

  watch(namespaceKey, () => {
    reset().catch((error: unknown) => {
      metadataState.value = {
        status: 'error',
        error: error instanceof Error ? error.message : '查询重置失败',
      };
    });
  }, { immediate: true });

  return {
    rowSlots: shallowReadonly(rowSlots),
    totalRowCount: shallowReadonly(totalRowCount),
    groupDirectory: shallowReadonly(groupDirectory),
    metadataState: shallowReadonly(metadataState),
    windowStates: shallowReadonly(windowStates),
    replaceRow,
    refreshRanges,
    requestRanges,
    reset,
  };
}
