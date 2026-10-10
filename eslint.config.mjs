import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import magicNumbers from '@piro0919/eslint-config';
import tailwind from '@piro0919/eslint-config/tailwind';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // 決まりは全リポジトリで共有する（piro0919/eslint-config）。[...] に値をじかに書かず、globals.css の @theme に名前を付けて使う。
  // 文字列の定数（layout-ui.tsx の LABEL など）はこの検査に掛からないので、test/design-rules.test.ts でも見る
  ...tailwind({
    cssConfigPath: 'src/app/globals.css',
    files: ['src/**/*.{ts,tsx}'],
    level: 'error',
  }),
  // shadcn/ui の生成物は手を入れない。決まりを書き込んだ button.tsx だけは見る
  {
    files: ['src/components/ui/**'],
    ignores: ['src/components/ui/button.tsx'],
    rules: {
      'tailwindcss/no-arbitrary-value': 'off',
      'tailwindcss/no-custom-classname': 'off',
    },
  },
  // 名前の無い数字を落とす（piro0919/eslint-config）。テストとスクリプトは数字そのものが中身なので見ない。
  // CSS を使わずに描く共有の絵（OG 画像）も除く
  ...magicNumbers({
    files: ['src/**/*.{ts,tsx}'],
    level: 'error',
    ignores: ['src/app/opengraph-image.tsx'],
  }),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // 別のセッションの作業用のコピー（git worktree）。読むと同じコードを二重に見て、数万件のエラーになる
    '.claude/**',
    '.playwright-mcp/**',
    '.next-e2e/**',
    'test-results/**',
    'playwright-report/**',
  ]),
]);

export default eslintConfig;
