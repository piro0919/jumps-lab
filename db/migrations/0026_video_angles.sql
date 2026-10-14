-- 動画の上で手で測る角度（2026-10-14 に本人から任された）。見比べる画面で、止めたコマに点を打って測る（src/lib/video-angles.ts）。
-- 時間の目印（video.marks）と違い、1本にいくつでも（上限は src/lib/limits.ts の ANGLES_PER_VIDEO）、1つずつ消すので、別の表にする。
-- 持ち主は動画の行で決まる（video."userId"）。動画を消すと、その動画の測定も消える（アカウントを消したときも動画ごと消える）。
-- 点は動画の本来の幅と高さに対する割合（0〜1）。angle は3点（真ん中の点での角度）、lean は2点（垂直からの傾き）。
-- degrees はサーバーが点と本来の幅・高さから求めた値（ブラウザの送った度数は使わない）
create table video_angle (
  id uuid primary key default gen_random_uuid(),
  "videoId" uuid not null references video (id) on delete cascade,
  name text not null check (name in ('knee', 'hip', 'trunk', 'shin', 'arm', 'other')),
  kind text not null check (kind in ('angle', 'lean')),
  -- 動画の中の時刻（ミリ秒）。上限は時間の目印と同じ 600 秒
  "timeMs" integer not null check ("timeMs" between 0 and 600000),
  "frameWidth" integer not null check ("frameWidth" between 1 and 8192),
  "frameHeight" integer not null check ("frameHeight" between 1 and 8192),
  x1 double precision not null check (x1 between 0 and 1),
  y1 double precision not null check (y1 between 0 and 1),
  x2 double precision not null check (x2 between 0 and 1),
  y2 double precision not null check (y2 between 0 and 1),
  x3 double precision check (x3 between 0 and 1),
  y3 double precision check (y3 between 0 and 1),
  degrees double precision not null check (degrees between 0 and 180),
  "createdAt" timestamptz not null default now(),
  -- 3点目は angle にだけあり、lean には無い。傾きは 90° まで
  check ((kind = 'angle') = (x3 is not null)),
  check ((x3 is null) = (y3 is null)),
  check (kind = 'angle' or degrees <= 90)
);

-- 1本の測定を時刻の順に読む・数える
create index video_angle_video_idx on video_angle ("videoId", "timeMs");
