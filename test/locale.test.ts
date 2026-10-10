import { describe, expect, it } from 'vitest';
import { localeFromAcceptLanguage } from '@/i18n/locales';

describe('localeFromAcceptLanguage', () => {
  it.each([
    [null, 'en'],
    ['', 'en'],
    ['ja', 'ja'],
    ['en-US,en;q=0.9', 'en'],
    ['ja,en-US;q=0.9,en;q=0.8', 'ja'],
    // 並びではなく重みで選ぶ
    ['en;q=0.8,ja;q=0.9', 'ja'],
    ['ja;q=0.5,en;q=0.9', 'en'],
    // 持っていない言語だけなら既定
    ['fr-FR,fr;q=0.9', 'en'],
    ['ja;q=0.3,fr;q=0.9', 'ja'],
    // q=0 は「要らない」
    ['ja;q=0,en;q=0.1', 'en'],
  ])('%s → %s', (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected);
  });
});
