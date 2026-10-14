import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 見た目の決まり（CLAUDE.md の「Design rules」と src/components/layout-ui.tsx の先頭）から外れた書き方を見つける。
 * 画面ごとに寸法をその場で書き、ボタン・札・数字の形がばらばらになった（2026-10-11 に本人に指摘されて洗い出した）。
 * vocafy の test/design-rules.test.ts と同じ作り。決まりを変えるときは、ここも一緒に変える
 */

const ROOT = join(import.meta.dirname, '..', 'src');
const files = readdirSync(ROOT, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.tsx$/.test(f))
  // shadcn/ui の生成物は、決まりを書き込んだ button.tsx 以外は手を入れない
  .filter((f) => !f.startsWith('components/ui/'))
  .map((f) => ({ path: f, text: readFileSync(join(ROOT, f), 'utf8') }));

/** 部品と決まりを持つファイル。ここだけは寸法を書いてよい */
const SYSTEM = 'components/layout-ui.tsx';

/** 決まりに合わない行を「ファイル:行」で集める。コメントの行は見ない */
function offenders(test: (line: string) => boolean, allow: string[] = []): string[] {
  return files.flatMap(({ path, text }) =>
    allow.includes(path)
      ? []
      : text
          .split('\n')
          .flatMap((line, i) =>
            /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line) || !test(line) ? [] : [`${path}:${i + 1}`],
          ),
  );
}

describe('見た目の決まり', () => {
  it('字の太さは semibold・bold・extrabold だけ（medium は使わない）', () => {
    expect(offenders((l) => /\bfont-medium\b/.test(l))).toEqual([]);
  });

  it('角は full・xl・2xl・3xl だけ（アプリのアイコンの 22% と、LP のスマホの枠の角は部品の中だけ）', () => {
    expect(
      offenders(
        (l) =>
          /\brounded(?!-(full|xl|2xl|3xl|\[inherit\])\b)(-[\w[\]]+)?\b/.test(
            l.replace(/'rounded-app-icon'/, '').replace(/\brounded-phone(-screen)?\b/, ''),
          ),
        // 規約の本文の英文（rounded to about 100 m）
        ['app/(legal)/en/privacy/page.tsx'],
      ),
    ).toEqual([]);
  });

  it('数字の字（font-display）は部品からだけ使う', () => {
    expect(offenders((l) => /\bfont-display\b/.test(l), [SYSTEM])).toEqual([]);
  });

  it('ロゴの字（font-logo）は Wordmark からだけ使う', () => {
    expect(offenders((l) => /\bfont-logo\b/.test(l), [SYSTEM])).toEqual([]);
  });

  it('字の大きさを px で書くのは部品の中だけ（ほかは text-xs・sm・base・lg）', () => {
    expect(offenders((l) => /\btext-\[\d+px\]/.test(l), [SYSTEM])).toEqual([]);
  });

  it('globals.css で部品に名前を付けた寸法（ページの題・透かしの字、アイコンとスマホの枠の角と大きさ）は部品の中だけ、規約の題の字は規約の文書の中だけ', () => {
    expect(
      offenders(
        (l) =>
          /\b(text-(page-title|watermark)|rounded-(app-icon|phone|phone-screen)|max-w-phone|h-phone)\b/.test(
            l,
          ),
        [SYSTEM],
      ).concat(offenders((l) => /\btext-legal-title\b/.test(l), ['app/(legal)/legal.tsx'])),
    ).toEqual([]);
  });

  it('xl より大きな字は使わない（大きな数字は DisplayNumber、見出しは PageTitle）', () => {
    expect(offenders((l) => /\btext-(xl|[2-9]xl)\b/.test(l), [SYSTEM])).toEqual([]);
  });

  it('小さな札は Badge から作る（丸い地に小さな字をその場で書かない）', () => {
    expect(
      offenders(
        (l) => /\brounded-full\b/.test(l) && /\bpx-[\d.]+\b/.test(l) && /\btext-xs\b/.test(l),
        [SYSTEM],
      ),
    ).toEqual([]);
  });

  it('ボタンに寸法を足さない（大きさは size で選ぶ）', () => {
    const tags = files.flatMap(({ path, text }) =>
      [...text.matchAll(/<Button\b[^>]*>/g)]
        .filter((m) => /className=/.test(m[0]) && /\b(h|px|py|text)-[\w[\]]+/.test(m[0]))
        .map((m) => `${path}: ${m[0].replace(/\s+/g, ' ').slice(0, 80)}`),
    );
    expect(tags).toEqual([]);
  });

  it('Tailwind の色の名前（blue-600 など）を使わない（天気の空の色だけ例外）', () => {
    expect(
      offenders(
        (l) =>
          /\b(bg|text|from|via|to|fill|stroke|border|ring|accent)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d/.test(
            l,
          ),
        // 天気のカードは空の色のグラデーションを天気ごとに持つ
        ['components/weather-card.tsx'],
      ),
    ).toEqual([]);
  });

  it('PC の2列は MAIN_SIDE か HALVES で組む（画面ごとに列の幅を書かない）', () => {
    expect(offenders((l) => /\b(md|lg):grid-cols-\[/.test(l), [SYSTEM])).toEqual([]);
  });

  it('入力の画面の幅は FORM_PAGE で決める（画面ごとに max-w を書かない）', () => {
    expect(offenders((l) => /\b(md|lg):max-w-/.test(l), [SYSTEM, 'app/(app)/layout.tsx'])).toEqual(
      [],
    );
  });

  it('塊の見出し（16px の極太）は SectionTitle からだけ使う（大会名や題をその場で組まない）', () => {
    expect(
      offenders(
        (l) => /\btext-base\b.*\bfont-extrabold\b|\bfont-extrabold\b.*\btext-base\b/.test(l),
        [SYSTEM],
      ),
    ).toEqual([]);
  });

  it('色を直に書かない（Google のボタンの決まりの色だけ例外）', () => {
    expect(
      offenders(
        (l) => /#[0-9a-fA-F]{3,8}\b/.test(l),
        ['app/sign-in/google-button.tsx', 'app/share-image.tsx'],
      ),
    ).toEqual([]);
  });

  it('クラスをまとめる cn は src/lib/cn.ts から使い、globals.css の字の大きさの名前を全部知らせてある', () => {
    // そのままの cn は名前を付けた字の大きさを字の色と取り違え、片方を消す（2026-10-11）
    expect(
      files
        .filter(({ path, text }) => path !== 'lib/cn.ts' && /from 'cn'/.test(text))
        .map((f) => f.path),
    ).toEqual([]);
    const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8');
    const sizes = [...css.matchAll(/--text-([\w-]+):/g)].map((m) => m[1]);
    const cn = readFileSync(join(ROOT, 'lib/cn.ts'), 'utf8');
    expect(sizes.filter((name) => !cn.includes(`'${name}'`))).toEqual([]);
  });
});
