-- 主目標の大会の印（2026-10-11 に本人と決めた）。今日のアドバイスが、主目標の大会の前2週間を調整期にする。
-- 印の無い大会は前の1〜3日だけ軽めにする（毎週のように試合がある学生を、いつも調整期にしないため）
alter table competition add column "isTarget" boolean not null default false;
