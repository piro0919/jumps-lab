-- 同意した AI コーチの説明の版（2026-10-14）。送る項目を変えたら版を上げ、前の版に同意した人にはもう一度聞く。
-- 自己ベストと今季ベストを送るようにしたときに足した。今までの同意は版 1 とする
alter table profile add column "aiConsentVersion" smallint;
update profile set "aiConsentVersion" = 1 where "aiConsentAt" is not null;
