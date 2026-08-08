import type { JsonValue, SubmitFormRequest } from '@weave/types';
import { canonicalizeJson } from '@weave/utils';

export interface FormSubmissionAttempt {
  key: string;
  snapshot: string;
}

/** Create or reuse an idempotency key for one exact answers/revision snapshot. */
export function prepareFormSubmissionAttempt(
  previous: FormSubmissionAttempt | null,
  request: Omit<SubmitFormRequest, 'formId'>,
  createKey: () => string,
): FormSubmissionAttempt {
  const snapshot = canonicalizeJson({
    answers: request.answers,
    expectedRevision: request.expectedRevision ?? null,
  } as JsonValue);
  if (previous?.snapshot === snapshot) return previous;
  return { key: createKey(), snapshot };
}
