import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * サーバーの決まりを、型検査や lint の外で確かめる（spatto の action-guards・use-server-async・server-env と同じ考え）。
 * どれも破っても型検査も lint もテストも通ったまま、本番でだけ壊れる:
 * - Server Action が押した人を自分で確かめないと、ブラウザから送られた id で他人の記録を書ける
 * - "use server" のファイルが同期の関数を export すると、読み込むページが 500 で落ちる
 * - 鍵（環境変数）を読むファイルがクライアントの束に入ると、値が undefined になる
 */

const ROOT = join(import.meta.dirname, '..', 'src');
const files = readdirSync(ROOT, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => ({ path: f, source: readFileSync(join(ROOT, f), 'utf8') }));

/** 注釈を落とした中身 */
const shown = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** 先頭の文が "use server" か（注釈の中の言及は拾わない） */
const isUseServer = (source: string) => /^\s*['"]use server['"]/.test(shown(source));

const serverFiles = files.filter((f) => isUseServer(f.source));

describe('Server Action', () => {
  /** export された action と、その本体（関数の閉じ括弧まで） */
  const actions = serverFiles.flatMap(({ path, source }) =>
    [...source.matchAll(/^export async function ([^\s(<]+)/gm)].map((m) => {
      const rest = source.slice(m.index);
      const close = rest.indexOf('\n}\n');
      return { path, name: m[1]!, body: shown(close === -1 ? rest : rest.slice(0, close)) };
    }),
  );

  /** 確かめなくてよいもの（理由つき） */
  const exempt: Record<string, string> = {
    // 画面の言語を選ぶだけ。ログイン前の画面でも使え、本人の記録には触れない
    setLocaleAction: 'Cookie に言語を書くだけ',
    // 保護者の同意の画面（ログインの無い画面）。押した人はメールのリンクの鍵で確かめる
    agreeGuardianAction: 'リンクの鍵（ハッシュで探し、期限の内・1回だけ）で確かめる',
  };

  it('action を拾えている（拾い方が壊れて 0 件で通らないように）', () => {
    expect(actions.length).toBeGreaterThanOrEqual(10);
  });

  it('押した人を requireViewer で自分で確かめている', () => {
    const loose = actions
      .filter((a) => !(a.name in exempt))
      .filter((a) => !/\brequireViewer\(/.test(a.body))
      .map((a) => `${a.path}: ${a.name}`);
    expect(loose).toEqual([]);
  });
});

describe('"use server" のファイル', () => {
  /** async でない export（型だけの export は実行時に出てこないので外す） */
  const syncExports = (source: string): string[] =>
    [...shown(source).matchAll(/^export\s+[^\n]*/gm)]
      .map(([line]) => line.trim())
      .filter((line) => !/^export\s+(?:default\s+)?async\s+function\b/.test(line))
      .filter((line) => !/^export\s+(?:const|let|var)\s+\w+\s*(?::[^=]+)?=\s*async\b/.test(line))
      .filter((line) => !/^export\s+type\b/.test(line));

  it('"use server" のファイルが在る', () => {
    expect(serverFiles.length).toBeGreaterThanOrEqual(5);
  });

  it('export は全部 async', () => {
    expect(
      serverFiles.flatMap(({ path, source }) => syncExports(source).map((l) => `${path}: ${l}`)),
    ).toEqual([]);
  });

  it('同期の export を見せたら拾える（物差しを先に疑う）', () => {
    expect(syncExports("'use server';\nexport function helper() {}\n")).toEqual([
      'export function helper() {}',
    ]);
    expect(syncExports("'use server';\nexport async function act() {}\n")).toEqual([]);
  });
});

describe('鍵を読むファイル', () => {
  /** 鍵（src/env.ts の値か、NEXT_PUBLIC_ の付かない環境変数）を読むか */
  const readsSecrets = (source: string) =>
    /from '@\/env'/.test(shown(source)) ||
    [...shown(source).matchAll(/process\.env\.([A-Z0-9_]+)/g)].some(
      (m) => !m[1]!.startsWith('NEXT_PUBLIC_') && m[1] !== 'NODE_ENV',
    );

  const reading = files.filter((f) => readsSecrets(f.source));

  it('鍵を読むファイルが在る', () => {
    expect(reading.length).toBeGreaterThanOrEqual(2);
  });

  it('server-only を読み込んでいる（env.ts は next.config からも読むので外す。route と proxy はもともとサーバーだけ）', () => {
    const loose = reading
      .filter(({ path }) => !/^env\.ts$|route\.ts$|proxy\.ts$|instrumentation\.ts$/.test(path))
      .filter(({ source }) => !shown(source).includes("'server-only'") && !isUseServer(source))
      .map(({ path }) => path);
    expect(loose).toEqual([]);
  });
});
