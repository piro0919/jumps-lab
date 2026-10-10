import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import ja from '../messages/ja.json';

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
    for (const [key, value] of flatten(messages)) {
      expect(typeof value, key).toBe('string');
      expect((value as string).trim(), key).not.toBe('');
    }
  });

  // 片方の言語にだけある文言を作らない
  it('英語と日本語のキーがそろっている', () => {
    const keys = (messages: unknown) => flatten(messages).map(([key]) => key);
    expect(keys(ja).toSorted()).toEqual(keys(en).toSorted());
  });

  // 英語の画面に和文の記号や文字が混ざらないようにする（spatto で踏んだ）
  it('英語の文言に全角の文字が無い', () => {
    for (const [key, value] of flatten(en)) {
      expect(value as string, key).not.toMatch(/[　-ヿ一-鿿＀-￯]/);
    }
  });
});
