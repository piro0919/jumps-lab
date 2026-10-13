-- プラン（2026-10-14 に本人と決めた）。AI の機能は premium の人だけが使える。
-- AI の費用は中元さんが持ち、まずはテスター数人だけに出すため。課金ができるまでは、管理画面か手で切り替える。
-- 今いる人は free から始まる（本番で AI を使えていた人も、Premium にするまで使えなくなる）
alter table profile add column plan text not null default 'free' check (plan in ('free', 'premium'));
