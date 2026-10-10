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
  // 名前の無い数字と Tailwind の [...] を警告する（全リポジトリで共有する piro0919/eslint-config）
  ...magicNumbers(),
  ...tailwind({ cssConfigPath: 'src/app/globals.css' }),
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
