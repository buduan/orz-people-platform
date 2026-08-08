export type DatasetCellFinalizeAction = 'commit' | 'release';

export function getDatasetCellFinalizeActions(
  changed: boolean,
  valid: boolean,
): DatasetCellFinalizeAction[] {
  if (changed && valid) {
    return ['commit', 'release'];
  }

  return ['release'];
}
