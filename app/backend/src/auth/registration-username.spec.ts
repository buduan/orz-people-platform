import { describe, expect, it } from 'vitest';

import { registrationUsernameCandidate } from './registration-username';

describe('registration username candidate', () => {
  it('normalizes local parts and produces bounded collision suffixes', () => {
    expect(registrationUsernameCandidate('Lin@Example.com')).toBe('lin');
    expect(registrationUsernameCandidate('9.a+tag@example.com')).toBe('u-9-a-tag');
    expect(registrationUsernameCandidate('a@example.com')).toBe('a-user');
    expect(registrationUsernameCandidate(`${'a'.repeat(80)}@example.com`)).toHaveLength(64);
    expect(registrationUsernameCandidate('lin@example.com', 1)).toBe('lin-2');
  });
});
