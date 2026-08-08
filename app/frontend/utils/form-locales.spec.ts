import { describe, expect, it } from 'vitest';

import {
  canonicalizeFormLocale,
  defaultFormLocale,
  detectFormLocale,
  formatFormLocale,
  orderFormLocales,
} from './form-locales';

describe('Form locales', () => {
  it('canonicalizes and falls back from browser languages', () => {
    expect(canonicalizeFormLocale('zh-cn')).toBe('zh-CN');
    expect(canonicalizeFormLocale('not_a_locale')).toBeNull();
    expect(detectFormLocale(['not_a_locale', 'en-us'])).toBe('en-US');
    expect(detectFormLocale([])).toBe(defaultFormLocale);
  });

  it('keeps the default locale first and labels known and unknown locales', () => {
    expect(orderFormLocales('en', ['fr', 'en', 'ja', 'fr'])).toEqual(['en', 'fr', 'ja']);
    expect(formatFormLocale('zh-CN')).toBe('简体中文 (zh-CN)');
    expect(formatFormLocale('it-IT')).toContain('(it-IT)');
  });
});
