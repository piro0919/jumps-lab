-- 練習と試合の動画（2026-10-11 に本人と決めた）。日に付け、1日に何本でも。試技1本と結び付けてもよい。
-- 本体は Cloudflare R2 の非公開のバケットに置き、ここには置き場所（objectKey）と大きさだけを持つ。
-- ブラウザが R2 へ直接送るので、送る前に pending の行を作って枠を取り、届いたのを確かめてから ready にする。
-- 1本 100MB まで（長さ 60 秒までは画面で確かめる）、1人の合計 1GB まで（src/lib/videos.ts）
create table video (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user" ("id") on delete cascade,
  day date not null,
  event text not null check (event in ('high_jump', 'long_jump', 'triple_jump', 'pole_vault')),
  kind text not null check (kind in ('practice', 'competition')),
  -- 試技を消しても動画は日に残す（結び付きだけ外れる）
  "attemptId" uuid references attempt ("id") on delete set null,
  note text check (char_length(note) <= 500),
  "objectKey" text not null unique,
  "contentType" text not null,
  "sizeBytes" integer not null check ("sizeBytes" > 0 and "sizeBytes" <= 104857600),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  "createdAt" timestamptz not null default now()
);

create index video_user_day_idx on video ("userId", day);
