-- 週の始まり（2026-10-11 に本人と決めた）。0 が日曜、1 が月曜。日本と米国は日曜、欧州など多くの国は月曜。
-- はじめの値は登録したときのブラウザの地域から決め、設定の「記録」で直せる。今いる人は日曜のまま
alter table profile add column "weekStart" smallint not null default 0 check ("weekStart" in (0, 1));
