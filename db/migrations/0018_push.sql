-- 通知（Web Push）の宛先。ブラウザが発行した宛先（endpoint）と暗号の鍵を、通知を入れた人に結ぶ。
-- 1人が複数の端末で入れられるので、行は端末ごと。文言の言語は入れたときの画面の言語で決める
create table push_subscription (
  endpoint text primary key,
  "userId" text not null references "user" ("id") on delete cascade,
  p256dh text not null,
  auth text not null,
  locale text not null check (locale in ('en', 'ja')),
  "createdAt" timestamptz not null default now()
);

create index push_subscription_user_idx on push_subscription ("userId");

-- 送った知らせの印。送る前に印を付け、付けられたときだけ送る（同じ大会の前日の知らせを二度送らない）
create table push_sent (
  key text primary key,
  "sentAt" timestamptz not null default now()
);
