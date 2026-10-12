-- AI コーチの第2段階（2026-10-12 に本人と決めた。課金ができるまで全員に出す）。今日のメニューをチャットで直す。
-- メニューは直すたびに version を上げて上書きする（1日に1つは変えない）。minutes は練習時間（チャットで変わることがある）。
-- 前からある行は練習時間を持っていないので空
alter table practice_menu add column version integer not null default 1;
alter table practice_menu add column minutes integer check (minutes between 15 and 240);

-- チャットのやりとり。assistant の行には、その返事で直したメニューの version を持つ（直さなかったら null）
create table menu_message (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user" ("id") on delete cascade,
  day date not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 4000),
  version integer,
  "createdAt" timestamptz not null default now()
);

create index menu_message_user_day_idx on menu_message ("userId", day);
