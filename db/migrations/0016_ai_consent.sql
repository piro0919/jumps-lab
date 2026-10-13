-- AI コーチを使うことに同意した時刻（2026-10-14 に本人・中元さんと決めた）。
-- 初めてメニューを作る前に、OpenAI（米国の会社）へ何を送るかを見せて同意を取る。同意していない人の AI は動かさない。
-- 今いる人は null から始まる（もう使っていた人も、次に作るときに同意の画面を通る）
alter table profile add column "aiConsentAt" timestamptz;
