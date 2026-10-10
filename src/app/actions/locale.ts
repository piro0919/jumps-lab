'use server';

import { refresh } from 'next/cache';
import { cookies } from 'next/headers';
import { isLocale, LOCALE_COOKIE } from '@/i18n/locales';

/** 言語の Cookie を残す日数（1年） */
const LOCALE_COOKIE_DAYS = 365;
const LOCALE_COOKIE_SECONDS = 60 * 60 * 24 * LOCALE_COOKIE_DAYS;

/**
 * 画面の言語を選ぶ。auto は Cookie を消して、ブラウザの言語に戻す。
 * Cookie は1年残し、.kkweb.io には広げない（CLAUDE.md）
 */
export async function setLocaleAction(value: string): Promise<void> {
  const store = await cookies();
  if (isLocale(value)) {
    store.set(LOCALE_COOKIE, value, { path: '/', maxAge: LOCALE_COOKIE_SECONDS, sameSite: 'lax' });
  } else {
    store.delete(LOCALE_COOKIE);
  }
  refresh();
}
