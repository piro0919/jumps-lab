-- AI コーチの今日のメニュー（2026-10-12 に本人と決めた。中元さんのフィードバックの第1段階）。
-- 1日に1つ。今日の強さは src/lib/readiness.ts が決め、AI はその中で中身を書く。跳躍の本数はサーバーが上限を確かめてから保存する。
-- menu は AI の返した JSON（src/lib/menu.ts の形）。使ったモデルも持つ（あとでプランごとに変えるため、回数も月ごとにここから数える）
create table practice_menu (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user" ("id") on delete cascade,
  day date not null,
  level text not null check (level in ('protect', 'preMeet', 'taper', 'lighter', 'normal')),
  model text not null,
  menu jsonb not null,
  "createdAt" timestamptz not null default now(),
  unique ("userId", day)
);
