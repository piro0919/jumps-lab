-- AI を呼んだ記録（2026-10-12）。呼ぶ前に1行入れ、1日・1か月の上限はここで数える。
-- 保存できたメニューだけを数えると、失敗した呼び出し（上限を超えたメニュー、壊れた返事）がいくらでも繰り返せた。
-- あとでプランごとの上限と、費用の見積もりにも使う
create table ai_call (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user" ("id") on delete cascade,
  day date not null,
  kind text not null check (kind in ('menu', 'chat')),
  model text not null,
  "createdAt" timestamptz not null default now()
);

create index ai_call_user_day_idx on ai_call ("userId", day);
