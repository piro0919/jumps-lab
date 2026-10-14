'use server';

import { refresh } from 'next/cache';
import { getLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { env } from '@/env';
import { AI_CONSENT_VERSION, aiConsenter, aiEnabled } from '@/lib/ai';
import {
  addGuardianRequest,
  agreeAsGuardian,
  declareAge,
  getProfile,
  latestGuardianRequest,
  releaseGuardianRequest,
  supersedeGuardianRequests,
} from '@/lib/data';
import type { ActionResult } from '@/lib/form';
import {
  GUARDIAN_LINK_DAYS,
  GUARDIAN_SENDS_PER_DAY,
  hashGuardianToken,
  newGuardianToken,
} from '@/lib/guardian';
import { EMAIL_MAX_LENGTH } from '@/lib/limits';
import { mailReady, sendMail } from '@/lib/mail';
import { SITE_URL } from '@/lib/site';
import { requireViewer } from '@/lib/viewer';

/** リンクの鍵の長さの上限。これより長いものは探さずに断る（鍵は 43 文字） */
const TOKEN_MAX_LENGTH = 100;

const emailSchema = z.email().max(EMAIL_MAX_LENGTH);

/**
 * 16歳未満の人が、保護者へ AI コーチの同意のお願いをメールで送る（2026-10-14 に本人と決めた）。
 * email が無ければ、前に送った宛先へ送り直す。生年月日の無い人は「16歳未満です」と答えて送る（adult=no）。
 * 送る前に行を入れて24時間の回数を数え、送れなければ行を消す。送れたら前のリンクを切る
 */
export async function sendGuardianRequestAction(formData: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  const profile = await getProfile(viewer.userId);
  if (!profile || !aiEnabled(profile)) return { ok: false, error: 'generic' };
  const declaredMinor = formData.get('adult') === 'no';
  // 生年月日がある人は年齢で決める。無い人は今の答えか、前に残した答えで決める
  const minor =
    profile.birthdate === null
      ? declaredMinor || profile.ageDeclared16Plus === false
      : aiConsenter(profile) === 'guardian';
  if (!minor) return { ok: false, error: 'generic' };
  if (!mailReady()) return { ok: false, error: 'guardianMailUnavailable' };

  const typed = formData.get('email');
  let guardianEmail: string;
  if (typeof typed === 'string') {
    const parsed = emailSchema.safeParse(typed.trim());
    if (!parsed.success) return { ok: false, error: 'guardianEmail' };
    guardianEmail = parsed.data;
  } else {
    const previous = await latestGuardianRequest(viewer.userId);
    if (!previous) return { ok: false, error: 'guardianEmail' };
    guardianEmail = previous.guardianEmail;
  }
  // 自分のアドレスに送って自分で同意するのを防ぐ（Google のアドレスだけ。ほかのアドレスまでは見分けられない）
  if (guardianEmail.toLowerCase() === viewer.email.toLowerCase()) {
    return { ok: false, error: 'guardianSelf' };
  }

  try {
    if (profile.birthdate === null && declaredMinor) await declareAge(viewer.userId, false);
    const token = newGuardianToken();
    const id = await addGuardianRequest(viewer.userId, {
      guardianEmail,
      tokenHash: hashGuardianToken(token),
      days: GUARDIAN_LINK_DAYS,
      perDay: GUARDIAN_SENDS_PER_DAY,
    });
    if (!id) return { ok: false, error: 'guardianLimit' };
    try {
      await sendMail({ to: guardianEmail, ...(await guardianMail(profile.name, token)) });
    } catch (error) {
      console.error(error);
      await releaseGuardianRequest(viewer.userId, id);
      return { ok: false, error: 'guardianMailUnavailable' };
    }
    await supersedeGuardianRequests(viewer.userId, id);
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
  refresh();
  return { ok: true };
}

/** 保護者へのメールの件名と本文。お願いした人の画面の言語で書く */
async function guardianMail(name: string, token: string) {
  const locale = (await getLocale()) === 'ja' ? 'ja' : 'en';
  const t = await getTranslations({ locale, namespace: 'guardianMail' });
  // 手元ではリンクを手元のサーバーに向ける。本番は BETTER_AUTH_URL がサイトの URL
  const url = `${env.BETTER_AUTH_URL ?? SITE_URL}/guardian-consent/${token}`;
  return {
    subject: t('subject', { name }),
    text: t('body', { name, url, days: GUARDIAN_LINK_DAYS }),
  };
}

/**
 * 保護者が同意する（/guardian-consent/[token]。ログインの無い画面）。押した人の確かめはリンクの鍵で行う:
 * 鍵が期限の内で使われていなければ、1回だけ使い、お願いした人にいまの版の保護者の同意を入れる。
 * 使えないリンクは、あるかどうかを言わずに同じ誤りを返す
 */
export async function agreeGuardianAction(token: string): Promise<ActionResult> {
  if (typeof token !== 'string' || token.length === 0 || token.length > TOKEN_MAX_LENGTH) {
    return { ok: false, error: 'guardianLinkInvalid' };
  }
  try {
    const agreed = await agreeAsGuardian(hashGuardianToken(token), AI_CONSENT_VERSION);
    return agreed ? { ok: true } : { ok: false, error: 'guardianLinkInvalid' };
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'generic' };
  }
}
