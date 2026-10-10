-- 選手の記録。プロトタイプ（跳躍ラボ）の仕様を写す。長さはすべてメートル、身長は cm、体重は kg で持ち、
-- フィート・インチへの切り替えは表示の側でやる

-- 本人の設定とプロフィール。ログインした user に1行
create table profile (
  "userId" text primary key references "user" ("id") on delete cascade,
  grade text,
  age smallint check (age between 5 and 120),
  gender text check (gender in ('male', 'female', 'other')),
  "heightCm" numeric(4, 1) check ("heightCm" > 0),
  "weightKg" numeric(4, 1) check ("weightKg" > 0),
  -- 取り組んでいる種目。1つ以上
  events text[] not null check (
    cardinality(events) > 0
    and events <@ array['high_jump', 'long_jump', 'triple_jump', 'pole_vault']
  ),
  -- 画面で見ている種目
  "currentEvent" text not null check (
    "currentEvent" in ('high_jump', 'long_jump', 'triple_jump', 'pole_vault')
  ),
  -- 表示の単位。metric はメートル・cm・kg、imperial はフィート・インチ・ポンド
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  -- シーズンの始まりの月。SB はこの月から1年で数える
  "seasonStartMonth" smallint not null default 1 check ("seasonStartMonth" between 1 and 12),
  -- 「今日」を数える時間帯（IANA の名前）。ブラウザから受け取る
  "timeZone" text not null default 'UTC',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- 種目ごとの目標と、手で入れたベスト。記録から出した値と比べて高い方を見せる
create table event_target (
  "userId" text not null references "user" ("id") on delete cascade,
  event text not null check (event in ('high_jump', 'long_jump', 'triple_jump', 'pole_vault')),
  "seasonGoalM" numeric(5, 2) check ("seasonGoalM" > 0),
  "manualPbM" numeric(5, 2) check ("manualPbM" > 0),
  "manualSbM" numeric(5, 2) check ("manualSbM" > 0),
  -- 手で入れた SB がどのシーズンのものか（シーズンが始まった年）。シーズンが変わったら数えない
  "manualSbSeason" smallint,
  "manualPracticeBestM" numeric(5, 2) check ("manualPracticeBestM" > 0),
  "updatedAt" timestamptz not null default now(),
  primary key ("userId", event)
);

-- 1日の体調と練習メモ。1人1日1行
create table day_log (
  "userId" text not null references "user" ("id") on delete cascade,
  day date not null,
  condition smallint check (condition between 1 and 10),
  fatigue smallint check (fatigue between 1 and 10),
  "sleepHours" numeric(3, 1) check ("sleepHours" between 0 and 24),
  injury text check (char_length(injury) <= 500),
  note text check (char_length(note) <= 2000),
  "updatedAt" timestamptz not null default now(),
  primary key ("userId", day)
);

-- 1本ずつの記録。動画は後で、この id に紐づける
create table attempt (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user" ("id") on delete cascade,
  day date not null,
  event text not null check (event in ('high_jump', 'long_jump', 'triple_jump', 'pole_vault')),
  kind text not null check (kind in ('practice', 'competition')),
  "markM" numeric(5, 2) not null check ("markM" > 0 and "markM" < 30),
  -- 風速（m/s）。追い風が正
  "windMs" numeric(3, 1) check ("windMs" between -20 and 20),
  note text check (char_length(note) <= 500),
  "createdAt" timestamptz not null default now()
);

create index attempt_user_event_day_idx on attempt ("userId", event, day);

-- 大会の予定
create table competition (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user" ("id") on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  day date not null,
  venue text check (char_length(venue) <= 200),
  "callRoomPlace" text check (char_length("callRoomPlace") <= 200),
  "callRoomTime" time,
  "startTime" time,
  notes text check (char_length(notes) <= 2000),
  "createdAt" timestamptz not null default now()
);

create index competition_user_day_idx on competition ("userId", day);
