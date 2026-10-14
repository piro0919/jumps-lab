/**
 * 入力の範囲。画面の欄（maxLength・min・max）と Server Action の検査で同じ値を使う。
 * 画面とサーバーの両方から読むので、server-only にしない
 */

/** 試技・動画のメモと、けがのメモの字数 */
export const NOTE_MAX_LENGTH = 500;
/** その日の練習メモと、大会のメモの字数 */
export const LONG_NOTE_MAX_LENGTH = 2000;

/** 大会の申し込みのサイトの URL の字数 */
export const URL_MAX_LENGTH = 2000;

/** 記録（メートル）の下限と上限 */
export const MARK_MIN_M = 0.01;
export const MARK_MAX_M = 29.99;

/** 風（m/s）の上限。下限はこの負の値 */
export const WIND_LIMIT_MS = 20;

/** 体調と疲れの段階の上限（1〜10） */
export const SCALE_MAX = 10;

/** 身長（cm）と体重（kg）の範囲 */
export const HEIGHT_MIN_CM = 50;
export const HEIGHT_MAX_CM = 250;
export const WEIGHT_MIN_KG = 20;
export const WEIGHT_MAX_KG = 300;

/** シーズンの始まりの月の上限（12月） */
export const MONTHS_PER_YEAR = 12;

/** 保護者のメールアドレスの字数（メールアドレスの上限の 254 文字） */
export const EMAIL_MAX_LENGTH = 254;

/** チームの名前の字数 */
export const TEAM_NAME_MAX_LENGTH = 50;

/** 利用者の id（Better Auth が振る文字列）の長さの上限。これより長いものは探さない（コーチの画面と Server Action） */
export const USER_ID_MAX_LENGTH = 200;

/** コーチと選手のコメントの字数（DB の上限は 2000。余裕を持たせる） */
export const COMMENT_MAX_LENGTH = 1000;
