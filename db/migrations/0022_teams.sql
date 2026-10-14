-- チームとコーチ（2026-10-14 に本人と決めた。クラブに売るための土台。課金はまだ無い）。
-- コーチが選手の記録を見るのは、Jumps Lab が選手に代わって記録をコーチ（第三者）に渡すこと。
-- 根拠は選手の同意で、チームに入るときにまとめて1回取る（個人情報保護委員会 Q&A 7-8）。
-- 痛みのメモは体のことなので、同意なしでは渡さない。16歳未満の人は保護者の同意で入る（AI コーチと同じ）

-- チーム。名前だけを持つ。作った人がコーチになる
create table team (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  "createdAt" timestamptz not null default now()
);

-- チームのコーチ。1人で何チームでも持てる。コーチは自分の記録もつけられる（選手と同じ利用者）
create table team_coach (
  "teamId" uuid not null references team (id) on delete cascade,
  "userId" text not null references "user" (id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  primary key ("teamId", "userId")
);

create index team_coach_user_idx on team_coach ("userId");

-- チームの選手。行があるあいだだけ、そのチームのコーチが記録を見られる。抜けるか外されたら行を消す（見えなくなる）。
-- 同意した時刻と、だれが同意したか（本人か保護者か）を残す
create table team_member (
  "teamId" uuid not null references team (id) on delete cascade,
  "userId" text not null references "user" (id) on delete cascade,
  "consentedAt" timestamptz not null,
  "consentBy" text not null check ("consentBy" in ('self', 'guardian')),
  "joinedAt" timestamptz not null default now(),
  primary key ("teamId", "userId")
);

create index team_member_user_idx on team_member ("userId");

-- 招待のリンク。鍵はハッシュだけを持つ（DB が漏れてもリンクにならない）。14日で切れ、コーチが切ったり作り直したりできる。
-- 作り直すと前のリンクは切る（"revokedAt"）。切ったリンクを使った保護者へのお願いも、一緒に使えなくなる
create table team_invite (
  id uuid primary key default gen_random_uuid(),
  "teamId" uuid not null references team (id) on delete cascade,
  "tokenHash" text not null unique,
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null,
  "revokedAt" timestamptz
);

create index team_invite_team_idx on team_invite ("teamId");

-- 保護者へのお願い（0020）に、何への同意かを足す。ai は AI コーチ、team はチームへの参加（"inviteId" の招待から）。
-- 招待を指すのは、保護者が同意したときにもその招待がまだ使えるかを確かめるため（コーチが切ったリンクで入らない）
alter table guardian_consent_request add column purpose text not null default 'ai';
alter table guardian_consent_request
  add column "inviteId" uuid references team_invite (id) on delete cascade;
alter table guardian_consent_request add constraint guardian_consent_request_purpose_check
  check ((purpose = 'ai' and "inviteId" is null) or (purpose = 'team' and "inviteId" is not null));

-- コーチがいなくなったチーム（コーチがアカウントを消した）は消す。選手の記録を見る人のいないチームの名前と、
-- 宛先の無い招待を残さない。選手自身の記録には触れない（チームの行と、参加・招待の行だけが消える）
create function team_drop_without_coach() returns trigger
language plpgsql as $$
begin
  delete from team t
   where t.id = old."teamId"
     and not exists (select 1 from team_coach c where c."teamId" = old."teamId");
  return null;
end;
$$;

create trigger team_coach_drop_team after delete on team_coach
  for each row execute function team_drop_without_coach();
