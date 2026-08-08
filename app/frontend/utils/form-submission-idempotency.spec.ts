import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { prepareFormSubmissionAttempt } from './form-submission-idempotency';

describe('Form submission idempotency snapshots', () => {
  it('reuses an unchanged attempt and rotates after answers or revision change', () => {
    const createKey = vi.fn()
      .mockReturnValueOnce('key-1')
      .mockReturnValueOnce('key-2')
      .mockReturnValueOnce('key-3');
    const first = prepareFormSubmissionAttempt(null, {
      answers: { q_name: 'Ada' },
      expectedRevision: 1,
    }, createKey);
    const retry = prepareFormSubmissionAttempt(first, {
      answers: { q_name: 'Ada' },
      expectedRevision: 1,
    }, createKey);
    const changedAnswer = prepareFormSubmissionAttempt(retry, {
      answers: { q_name: 'Grace' },
      expectedRevision: 1,
    }, createKey);
    const changedRevision = prepareFormSubmissionAttempt(changedAnswer, {
      answers: { q_name: 'Grace' },
      expectedRevision: 2,
    }, createKey);

    expect(retry).toBe(first);
    expect(changedAnswer.key).toBe('key-2');
    expect(changedRevision.key).toBe('key-3');
    expect(createKey).toHaveBeenCalledTimes(3);
  });
});
