import { describe, expect, it } from 'vitest';

import {
  createRelationOptionRequest,
  isLatestRelationRequest,
} from './form-relation-options';

describe('relation option request helpers', () => {
  it('keys requests from only declared valueFrom dependencies', () => {
    const first = createRelationOptionRequest(
      'q_city',
      ['q_country'],
      { q_country: 'CN', q_unrelated: 'ignored' },
    );
    const unrelatedChange = createRelationOptionRequest(
      'q_city',
      ['q_country'],
      { q_country: 'CN', q_unrelated: 'changed' },
    );
    const dependencyChange = createRelationOptionRequest(
      'q_city',
      ['q_country'],
      { q_country: 'FR', q_unrelated: 'changed' },
    );

    expect(first.values).toEqual({ q_country: 'CN' });
    expect(unrelatedChange.key).toBe(first.key);
    expect(dependencyChange.key).not.toBe(first.key);
  });

  it('accepts only the latest async request sequence', () => {
    expect(isLatestRelationRequest(3, 3)).toBe(true);
    expect(isLatestRelationRequest(2, 3)).toBe(false);
  });
});
