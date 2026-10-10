-- 年齢をやめて生年月日を持つ。年齢は今日の日付から出す（毎年手で直さずに済む）。
-- 本番の DB を作る前に入れたので、年齢の列は同じ移行で消す
alter table profile add column birthdate date check (birthdate >= '1900-01-01');
alter table profile drop column age;
