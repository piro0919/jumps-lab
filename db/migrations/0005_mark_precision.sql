-- 記録を 0.1mm まで持つ。センチで丸めると、フィート・インチで入れた記録が戻らない
-- （6' 1" = 1.8542 m を 1.85 m で持つと、インチに戻して 6' 0¾" になる）
alter table attempt alter column "markM" type numeric(7, 4);
alter table event_target alter column "seasonGoalM" type numeric(7, 4);
alter table event_target alter column "manualPbM" type numeric(7, 4);
alter table event_target alter column "manualSbM" type numeric(7, 4);
alter table event_target alter column "manualPracticeBestM" type numeric(7, 4);
