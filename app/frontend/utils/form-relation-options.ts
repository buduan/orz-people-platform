import type { FormItemId, JsonValue } from '@weave/types';
import { canonicalizeJson } from '@weave/utils';

export interface RelationOptionRequest {
  key: string;
  values: Record<FormItemId, JsonValue>;
}

/** Build a stable request from only the relation filter's declared dependencies. */
export function createRelationOptionRequest(
  itemId: FormItemId,
  dependencyIds: readonly FormItemId[],
  answers: Readonly<Record<FormItemId, JsonValue | undefined>>,
): RelationOptionRequest {
  const values = Object.fromEntries(dependencyIds.flatMap((dependencyId) => {
    const value = answers[dependencyId];
    return value === undefined ? [] : [[dependencyId, value]];
  }));
  return {
    key: canonicalizeJson({ itemId, values }),
    values,
  };
}

/** Decide whether an async relation result still belongs to the latest request. */
export function isLatestRelationRequest(requestId: number, latestRequestId: number): boolean {
  return requestId === latestRequestId;
}
