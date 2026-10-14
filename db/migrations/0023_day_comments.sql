-- コーチと選手のやりとり（2026-10-14 に本人と決めた。「簡単に」）。選手の1日に付くコメント。
-- やりとりは「選手・日・チーム」ごとに分ける。コーチが書いたものも選手が書いたものも、どのチームの中の話かを持つ。
-- チームを持たない返事にすると、選手が入っているほかのチームのコーチにも見えてしまうため。
-- 読み書きできるのは、選手本人と、そのチームのコーチで選手がいまそのチームにいるときだけ（src/lib/data.ts が文の中で確かめる）。
-- 選手が抜けると、そのチームのコーチからは見えなくなる。選手本人は、抜けたチームのやりとりも見られる（書き足しはできない）
create table day_comment (
  id uuid primary key default gen_random_uuid(),
  -- どの選手の日か。選手がアカウントを消すと、その人の日のやりとりはすべて消える
  "athleteId" text not null references "user" (id) on delete cascade,
  day date not null,
  -- 書いた人（選手本人かコーチ）。書いた人がアカウントを消すと、その人のコメントも消える
  "authorId" text not null references "user" (id) on delete cascade,
  -- どのチームの中のやりとりか。チームが消えると、そのチームのやりとりも消える
  "teamId" uuid not null references team (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  "createdAt" timestamptz not null default now()
);

-- 1日のやりとりを読む（選手の日の画面・コーチの選手の画面）
create index day_comment_thread_idx on day_comment ("athleteId", day, "teamId", "createdAt");

-- 書いた人で消す（アカウントの削除の cascade）とチームで消す（チームの削除の cascade）
create index day_comment_author_idx on day_comment ("authorId");
create index day_comment_team_idx on day_comment ("teamId");
