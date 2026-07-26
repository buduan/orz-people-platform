import { describe, expect, it } from 'vitest';

import { resolveSafeRedirect } from './redirect';

describe('resolveSafeRedirect', () => {
  it('keeps local paths and rejects redirect attacks', () => {
    const origin = 'https://people.example.com';
    expect(resolveSafeRedirect('/workspace?tab=active#member', origin))
      .toBe('/workspace?tab=active#member');
    expect(resolveSafeRedirect('//evil.example/collect', origin)).toBe('/dashboard');
    expect(resolveSafeRedirect('https://evil.example/collect', origin)).toBe('/dashboard');
    expect(resolveSafeRedirect('/auth/login', origin)).toBe('/dashboard');
    expect(resolveSafeRedirect('/\\evil.example', origin)).toBe('/dashboard');
  });
});
