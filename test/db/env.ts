import { testUrl } from './urls';

// src/lib/db.ts のプールは src/env.ts の DATABASE_URL を読む。テストのファイルを読み込む前に、テスト用の DB を指しておく
process.env.DATABASE_URL = testUrl;
