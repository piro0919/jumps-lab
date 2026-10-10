import { z } from 'zod';

/**
 * フォームの値の読み方。空の欄は null にし、数の欄は数に直す。
 * Server Action は画面と同じ柵をここでもう一度かける（ブラウザを通らない要求もあるため）
 */

// 送られてこなかった欄（画面に出していない欄）も空として扱う
const emptyToNull = (value: unknown) =>
  value === undefined || (typeof value === 'string' && value.trim() === '') ? null : value;

export const optionalNumber = (min: number, max: number) =>
  z.preprocess(emptyToNull, z.coerce.number().min(min).max(max).nullable());

export const optionalText = (max: number) =>
  z.preprocess(
    (value) => emptyToNull(typeof value === 'string' ? value.trim() : value),
    z.string().max(max).nullable(),
  );

/** 画面に返す結果。文言は鍵で返し、画面の言語で組む */
export type ActionResult = { ok: true } | { ok: false; error: string } | null;
