-- チームのプラン（2026-10-15 に本人と決めた）。有料にするのはまずチーム向けのプランだけで、コーチがチーム単位で払う。
-- team のチームに今いる選手は、自分のプランが free でも AI コーチを使える（src/lib/ai.ts の aiEnabled）。
-- 値段は福岡大学の部での無料の試験（2〜3か月）のあとに決めるので、課金ができるまでは管理画面（/admin）で手で切り替える。
-- 今あるチームは free から始まる
alter table team add column plan text not null default 'free' check (plan in ('free', 'team'));
