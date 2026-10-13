-- 動画の時間の目印（2026-10-14 に本人と決めた）。助走の始まり・最後の3歩・踏み切り・着地の時刻を、
-- 動画の中の秒（ミリ秒まで）で持ち、あいだの時間をいつもの跳躍と見比べる（src/lib/video-marks.ts）。
-- 1本に決まった6つまでで、いつも動画と一緒に読み書きするので、別の表にせず動画の行に jsonb で持つ。
-- 動画の行と一緒に消え、持ち主も動画の行の "userId" で決まる。{"takeoff": 2.345} の形
alter table video add column marks jsonb not null default '{}' check (jsonb_typeof(marks) = 'object');
