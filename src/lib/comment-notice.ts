import { createTranslator } from 'next-intl';
import type { Locale } from '@/i18n/locales';
import en from '../../messages/en.json';
import ja from '../../messages/ja.json';

/**
 * コメントの知らせ（通知）の中身。DB も時計も読まない（test/comment-notice.test.ts）。
 * ロック画面に出るので、コメントの本文・記録・体調・痛みのメモは載せない。
 * 載せるのは「コーチから／選手から」と、チームの名前と、コーチへの知らせでは選手の表示名だけ（本人と決めた線）
 */

const MESSAGES = { en, ja } as const;

/** 知らせに載せる名前の字数。名前は本人が決めるもので、長いとロック画面を埋める */
const NAME_MAX_LENGTH = 50;

/** 制御文字・書式文字（向きを変える文字を含む）を除き、詰めて切る。何も残らなければ null */
export function noticeName(name: string): string | null {
  const cleaned = name
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned === '' ? null : [...cleaned].slice(0, NAME_MAX_LENGTH).join('');
}

export type CommentNoticeInput = {
  /** true は選手が書いてコーチへ知らせる、false はコーチが書いて選手へ知らせる */
  toCoaches: boolean;
  athleteId: string;
  athleteName: string;
  teamId: string;
  teamName: string;
  /** やりとりの日（YYYY-MM-DD） */
  day: string;
};

export type CommentNotice = { title: string; body: string; url: string; tag: string };

/**
 * 1つの言語の知らせ。押すと、選手は自分の日の画面、コーチは選手の画面のその日へ開く。
 * tag はやりとり（選手・日・チーム）ごと。続けて書かれても、端末には最新の1つだけが残る
 */
export function commentNotice(input: CommentNoticeInput, locale: Locale): CommentNotice {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'push' });
  const team = noticeName(input.teamName) ?? '';
  const tag = `comment-${input.teamId}-${input.athleteId}-${input.day}`;
  if (input.toCoaches) {
    const name = noticeName(input.athleteName);
    return {
      title:
        name === null ? t('commentFromAthleteTitleNoName') : t('commentFromAthleteTitle', { name }),
      body: t('commentBody', { team }),
      url: `/teams/${input.teamId}/members/${encodeURIComponent(input.athleteId)}#day-${input.day}`,
      tag,
    };
  }
  return {
    title: t('commentFromCoachTitle'),
    body: t('commentBody', { team }),
    url: `/log/${input.day}#comments`,
    tag,
  };
}
