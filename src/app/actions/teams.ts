'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { env } from '@/env';
import {
  createInvite,
  createTeam,
  deleteTeam,
  joinTeamBySelf,
  leaveTeam,
  removeMember,
  renameTeam,
  revokeInvites,
} from '@/lib/data';
import type { ActionResult } from '@/lib/form';
import { TEAM_NAME_MAX_LENGTH } from '@/lib/limits';
import { SITE_URL } from '@/lib/site';
import { hashInviteToken, INVITE_DAYS, INVITE_TOKEN_MAX_LENGTH, newInviteToken } from '@/lib/teams';
import { requireProfile, requireViewer } from '@/lib/viewer';

/**
 * チームとコーチの操作（2026-10-14）。どれも押した人を requireViewer で決め、チームのコーチか・選手かは
 * src/lib/data.ts の文の中で確かめる（ブラウザから来た id を信じない）
 */

const teamName = z.string().trim().min(1, 'teamName').max(TEAM_NAME_MAX_LENGTH, 'teamName');
const teamId = z.uuid();
/** 利用者の id（Better Auth が振る文字列）の長さの上限。これより長いものは探さない */
const USER_ID_MAX_LENGTH = 200;
const userId = z.string().min(1).max(USER_ID_MAX_LENGTH);
const inviteToken = z.string().min(1).max(INVITE_TOKEN_MAX_LENGTH);

/** チームを作り、そのチームの画面へ送る。作った人がコーチになる */
export async function createTeamAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  await requireProfile(viewer.userId);
  const parsed = teamName.safeParse(formData.get('name'));
  if (!parsed.success) return { ok: false, error: 'teamName' };
  let id: string;
  try {
    id = await createTeam(viewer.userId, parsed.data);
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  redirect(`/teams/${id}`);
}

/** チームの名前を変える（コーチだけ） */
export async function renameTeamAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const id = teamId.safeParse(formData.get('teamId'));
  const name = teamName.safeParse(formData.get('name'));
  if (!id.success) return { ok: false, error: 'generic' };
  if (!name.success) return { ok: false, error: 'teamName' };
  try {
    if (!(await renameTeam(viewer.userId, id.data, name.data)))
      return { ok: false, error: 'generic' };
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  refresh();
  return { ok: true };
}

/** チームを消す（コーチだけ）。選手の記録には触れない。消したらチームの一覧へ */
export async function deleteTeamAction(id: string): Promise<void> {
  const viewer = await requireViewer();
  if (!teamId.safeParse(id).success) return;
  await deleteTeam(viewer.userId, id);
  redirect('/teams');
}

/** 招待のリンクを作った結果。リンクは鍵のハッシュしか残さないので、見せられるのは作ったこの1回だけ */
export type InviteResult = { ok: true; url: string } | { ok: false; error: string };

/** 招待のリンクを作る（コーチだけ）。前のリンクは切る */
export async function createInviteAction(id: string): Promise<InviteResult> {
  const viewer = await requireViewer();
  if (!teamId.safeParse(id).success) return { ok: false, error: 'generic' };
  const token = newInviteToken();
  try {
    const expiresAt = await createInvite(viewer.userId, id, hashInviteToken(token), INVITE_DAYS);
    if (!expiresAt) return { ok: false, error: 'generic' };
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  refresh();
  // 手元ではリンクを手元のサーバーに向ける。本番は BETTER_AUTH_URL がサイトの URL
  return { ok: true, url: `${env.BETTER_AUTH_URL ?? SITE_URL}/join/${token}` };
}

/** 招待のリンクを切る（コーチだけ）。切ったリンクからは入れず、そのリンクからの保護者へのお願いも使えなくなる */
export async function revokeInviteAction(id: string): Promise<void> {
  const viewer = await requireViewer();
  if (!teamId.safeParse(id).success) return;
  await revokeInvites(viewer.userId, id);
  refresh();
}

/** 選手をチームから外す（コーチだけ）。外したときから、その選手の記録は見えない。外したらチームの画面へ */
export async function removeMemberAction(id: string, memberId: string): Promise<void> {
  const viewer = await requireViewer();
  if (!teamId.safeParse(id).success || !userId.safeParse(memberId).success) return;
  await removeMember(viewer.userId, id, memberId);
  redirect(`/teams/${id}`);
}

/** チームから抜ける（本人）。抜けたときから、コーチは記録を見られない */
export async function leaveTeamAction(id: string): Promise<void> {
  const viewer = await requireViewer();
  if (!teamId.safeParse(id).success) return;
  await leaveTeam(viewer.userId, id);
  refresh();
}

/**
 * 招待のリンクから、本人の同意でチームに入る（「同意して参加」）。入れたらチームの一覧へ。
 * 年齢の確かめは src/lib/data.ts の joinTeamBySelf の中（16歳未満は保護者の同意。src/app/actions/guardian.ts）。
 * adult=yes は、生年月日の無い人が「16歳以上です」と答えて押したこと
 */
export async function joinTeamAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const token = inviteToken.safeParse(formData.get('token'));
  if (!token.success) return { ok: false, error: 'teamInviteInvalid' };
  let result: Awaited<ReturnType<typeof joinTeamBySelf>>;
  try {
    result = await joinTeamBySelf(
      viewer.userId,
      hashInviteToken(token.data),
      formData.get('adult') === 'yes',
    );
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  if (result === 'invalid') return { ok: false, error: 'teamInviteInvalid' };
  if (result === 'coach') return { ok: false, error: 'teamCoachJoin' };
  if (result === 'guardian' || result === 'ask') return { ok: false, error: 'generic' };
  redirect('/teams');
}
