-- 保護者の同意（0020）の穴をふさぐ（2026-10-14 のコードレビュー）。
--
-- 1. 送り直しや保護者の同意で切ったお願いに印を付ける。期限で自然に切れたお願いと見分け、
--    本人の画面に「期限が切れました（x*** に送ったもの）」と出したり、古い宛先へ送り直したりしないため。
--    切った行も 24 時間の回数には数えるので消さない（期限の翌日を過ぎたら Cron が消す）
alter table guardian_consent_request add column "cancelledAt" timestamptz;

-- 2. 生年月日のある人の「16歳以上か」を、生年月日から埋める。生年月日で16歳未満と分かった人が、
--    あとで生年月日を消して「16歳以上です」と答え、本人だけで同意するのを防ぐ（これからは保存のたびに入れる）。
--    今日は UTC の日付で数える（本人の時間帯とは最大1日ずれる。生年月日がある間はこの列を使わないので害は無い）
update profile set "ageDeclared16Plus" = birthdate <= current_date - interval '16 years'
 where birthdate is not null;
