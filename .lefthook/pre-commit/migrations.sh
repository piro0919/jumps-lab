#!/usr/bin/env bash
# 一度コミットしたマイグレーションは書き換えも消しもしない（鯉魂と同じ、2026-10-11 に入れた）。
# 本番の DB はファイル名で「当てた」を覚えているので、書き換えた中身は二度と流れず、
# 手元と本番の DB が黙って食い違う。直したいときは新しい番号のファイルを足す。
# まだ push していない自分のファイルを直したいだけなら LEFTHOOK_EXCLUDE=migrations で飛ばせる
changed=$(git diff --cached --name-only --diff-filter=MDR -- 'db/migrations/*.sql')
if [ -n "$changed" ]; then
  echo "コミット済みのマイグレーションを書き換えるか消そうとしています:"
  echo "$changed" | sed 's/^/  /'
  echo "直すなら新しい番号のファイルを足してください（db/migrations/NNNN_*.sql）"
  exit 1
fi
