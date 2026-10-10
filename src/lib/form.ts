import { z } from 'zod';

/**
 * フォームの値の読み方。空の欄は null にし、数の欄は数に直す。
 * Server Action は画面と同じ柵をここでもう一度かける（ブラウザを通らない要求もあるため）
 */

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

export const optionalNumber = (min: number, max: number) =>
  z.preprocess(emptyToNull, z.coerce.number().min(min).max(max).nullable());

export const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? emptyToNull(value.trim()) : value),
    z.string().max(max).nullable(),
  );

/** 画面に返す結果。文言は鍵で返し、画面の言語で組む */
export type ActionResult = { ok: true } | { ok: false; error: string } | null;
