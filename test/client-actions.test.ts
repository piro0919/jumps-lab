import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * ブラウザから Server Action を呼ぶ所が、投げられた呼び出しを受け止めているかを見る
 * （nagara-kaigo の scripts/check-unguarded-write.mjs の考え。同じ壊れ方を6回直してから足した検査）。
 *
 * 電波が悪いと、await した Server Action は投げる。受け止めないと、フォームは何も出さずにボタンを戻すか、
 * 書いた文ごと誤りの画面へ落ちる。本人は保存できたと思って画面を離れる。
 * そこで、クライアントのファイルから @/app/actions の関数に触れる所は、次のどれかでなければ落とす:
 * - safely(() => ...) の中（src/lib/safe-action.ts。投げられたら errors.generic の値にする）
 * - startTransition(() => xAction(...)) と、そのまま渡すだけのもの。投げられたら誤りの画面（error.tsx）が
 *   出直すボタンと一緒に受ける。消す操作と言語の切り替えで、消えていない行や変わらない言語で気づける
 * - xAction(...).catch(...) と、その場で受けているもの
 * 書き方ではなく「action に触れている」ことで拾う。useActionState(xAction, null) のように、
 * 関数を渡して React に await させる書き方も同じく落ちる
 */

const ROOT = join(import.meta.dirname, '..', 'src');

/** 先頭の文が "use client" か */
const isUseClient = (source: string) => /^\s*['"]use client['"]/.test(source);

/** 受け止めていない、Server Action に触れている所を「行: 名前」で返す */
function unguarded(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const actions = new Set<string>();
  for (const statement of file.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith('@/app/actions/') &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      for (const element of statement.importClause.namedBindings.elements) {
        actions.add(element.name.text);
      }
    }
  }

  const calleeIs = (node: ts.Node, name: string) =>
    ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name;

  const isGuarded = (ref: ts.Identifier) => {
    for (let current: ts.Node | undefined = ref.parent; current; current = current.parent) {
      if (calleeIs(current, 'safely')) return true;
    }
    const call = ref.parent;
    if (!ts.isCallExpression(call) || call.expression !== ref) return false;
    // xAction(...).catch(...)
    if (ts.isPropertyAccessExpression(call.parent) && call.parent.name.text === 'catch')
      return true;
    // startTransition(() => xAction(...))
    const arrow = call.parent;
    return (
      ts.isArrowFunction(arrow) && arrow.body === call && calleeIs(arrow.parent, 'startTransition')
    );
  };

  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isIdentifier(node) && actions.has(node.text) && !isGuarded(node)) {
      const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      found.push(`${line}: ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

const files = readdirSync(ROOT, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ path: f, source: readFileSync(join(ROOT, f), 'utf8') }))
  .filter((f) => isUseClient(f.source));

describe('ブラウザからの Server Action の呼び出し', () => {
  it('Server Action を呼ぶクライアントのファイルを拾えている（拾い方が壊れて 0 件で通らないように）', () => {
    expect(files.filter((f) => f.source.includes("from '@/app/actions/")).length).toBeGreaterThan(
      5,
    );
  });

  it('投げられた呼び出しを受け止めている', () => {
    expect(
      files.flatMap(({ path, source }) => unguarded(path, source).map((hit) => `${path}:${hit}`)),
    ).toEqual([]);
  });

  it('受け止めていない書き方を見せたら拾える（物差しを先に疑う）', () => {
    const source = (body: string) =>
      `'use client';\nimport { saveAction } from '@/app/actions/today';\n${body}\n`;
    expect(
      unguarded('a.tsx', source('const f = async (d: FormData) => await saveAction(null, d);')),
    ).toEqual(['3: saveAction']);
    expect(unguarded('a.tsx', source('useActionState(saveAction, null);'))).toEqual([
      '3: saveAction',
    ]);
    expect(unguarded('a.tsx', source('useActionState(() => saveAction(), null);'))).toEqual([
      '3: saveAction',
    ]);
    expect(
      unguarded('a.tsx', source('const f = (d: FormData) => safely(() => saveAction(null, d));')),
    ).toEqual([]);
    expect(unguarded('a.tsx', source('startTransition(() => saveAction(id));'))).toEqual([]);
    expect(unguarded('a.tsx', source('saveAction(id).catch(() => {});'))).toEqual([]);
  });
});
