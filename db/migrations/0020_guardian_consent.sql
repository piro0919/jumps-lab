-- 16歳未満の人の AI コーチは、保護者の同意で使う（2026-10-14 に本人と決めた）。
-- AI コーチは痛みのメモなど体のことを米国の OpenAI へ送り、その根拠は同意。個人情報保護委員会の Q&A 1-62 は
-- 12〜15歳以下の子どもの同意を法定代理人から取るとし、2026年の改正法は16歳未満の同意を法定代理人から取ると書いた。
--
-- 保護者の同意は本人の同意（"aiConsentVersion"）と別の列に持つ。だれが同意したかで、版が上がったときに聞き直す相手が違うため。
-- 生年月日の無い人は「16歳以上か」を本人に聞き、答えを残す（毎回聞かない）。null はまだ答えていない
alter table profile add column "aiGuardianConsentVersion" smallint;
alter table profile add column "aiGuardianConsentAt" timestamptz;
alter table profile add column "ageDeclared16Plus" boolean;

-- 保護者へのお願い（メールで送るリンク）。リンクの鍵はハッシュだけを持つ（DB が漏れてもリンクにならない）。
-- 7日で切れ、1回使えば終わり。送り直すと前のリンクは切る。1日に送れる回数はこの表の行で数える。
-- 使われなかった行は期限の翌日を過ぎたら Cron が消し、同意に使われた行は同意の記録としてアカウントの削除まで残す
create table guardian_consent_request (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user" ("id") on delete cascade,
  "guardianEmail" text not null,
  "tokenHash" text not null unique,
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null,
  "usedAt" timestamptz
);

create index guardian_consent_request_user_idx on guardian_consent_request ("userId", "createdAt");
