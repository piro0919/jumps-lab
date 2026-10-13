import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import ja from '../messages/ja.json';
import { ENGLISH, loadMessages } from '../src/app/global-error-messages';

/** 文言のファイルを、キーの道筋と値の組に平たくする */
function flatten(value: unknown, path: string[] = []): [string, unknown][] {
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => flatten(child, [...path, key]));
  }
  return [[path.join('.'), value]];
}

describe('messages', () => {
  // 書きかけの空の文言が画面にそのまま出ないようにする
  it.each([
    ['en', en],
    ['ja', ja],
  ])('%s のすべての文言が空でない文字列である', (_, messages) => {
    const entries = flatten(messages);
    expect(entries.length).toBeGreaterThan(0);
    const blank = entries.filter(([, value]) => typeof value !== 'string' || value.trim() === '');
    expect(blank.map(([key]) => key)).toEqual([]);
  });

  // 片方の言語にだけある文言を作らない
  it('英語と日本語のキーがそろっている', () => {
    const keys = (messages: unknown) => flatten(messages).map(([key]) => key);
    expect(keys(ja).toSorted()).toEqual(keys(en).toSorted());
  });

  // 英語の画面に和文の記号や文字が混ざらないようにする（spatto で踏んだ）
  it('英語の文言に全角の文字が無い', () => {
    const entries = flatten(en);
    expect(entries.length).toBeGreaterThan(0);
    const wide = entries.filter(([, value]) => /[　-ヿ一-鿿＀-￯]/.test(String(value)));
    expect(wide.map(([key]) => key)).toEqual([]);
  });
});

// global-error.tsx は全ページに載るので、英語の文言を写して持つ（src/app/global-error-messages.ts）
describe('global-error の文言', () => {
  it('英語の写しが en.json と同じ', () => {
    expect(ENGLISH).toEqual({ metadata: { title: en.metadata.title }, errorPage: en.errorPage });
  });

  it('日本語は ja.json から読む', async () => {
    expect(await loadMessages('ja')).toEqual({
      metadata: { title: ja.metadata.title },
      errorPage: ja.errorPage,
    });
  });
});
