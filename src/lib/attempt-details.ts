import { z } from 'zod';
import type { JumpEvent } from '@/lib/events';
import { optionalInteger, optionalNumber } from '@/lib/form';
import {
  APPROACH_LENGTH_MAX_M,
  APPROACH_LENGTH_MIN_M,
  APPROACH_STEPS_MAX,
  APPROACH_STEPS_MIN,
  BOARD_OFFSET_MAX_CM,
  BOARD_OFFSET_MIN_CM,
  GRIP_HEIGHT_MAX_M,
  GRIP_HEIGHT_MIN_M,
  POLE_LENGTH_MAX_M,
  POLE_LENGTH_MIN_M,
  POLE_STIFFNESS_MAX_LB,
  POLE_STIFFNESS_MIN_LB,
  STANDARDS_MAX_CM,
  STANDARDS_MIN_CM,
} from '@/lib/limits';

/**
 * 試技ごとの跳躍の細かい記録（任意。2026-10-14 に本人から任された）。跳躍の選手が紙のノートに書いているもの。
 * 単位は DB と同じ（長さはメートル、短い長さは cm、ポールの硬さはポンド）。表示の単位へは画面の端で直す
 */
export type AttemptDetails = {
  /** 助走の歩数 */
  approachSteps: number | null;
  /** 助走の距離（メートル） */
  approachLengthM: number | null;
  /**
   * 踏切板の前の端（踏切線）から、踏み切った足のつま先までの距離（cm。走幅跳・三段跳）。
   * 正は踏切線より手前で、その分だけ記録を損している。負は踏切線を越えた（ファウル）。
   * 「手前に何 cm」と言うのが練習での普通の言い方なので、損をした向きを正にした
   */
  boardOffsetCm: number | null;
  /** ポールの長さ（メートル。棒高跳） */
  poleLengthM: number | null;
  /** ポールの硬さ（ポンド。棒高跳）。メートル法の国でもポールにはポンドで書かれている */
  poleStiffnessLb: number | null;
  /** グリップの高さ（メートル。棒高跳）。上の手からポールの下の端まで */
  gripHeightM: number | null;
  /** 支柱の位置（cm。棒高跳）。ボックスの奥の端から着地場所の向きへ */
  standardsCm: number | null;
};

export type DetailKey = keyof AttemptDetails;

/** 並びは画面の欄と、日の画面の1行の順 */
export const DETAIL_KEYS = [
  'approachSteps',
  'approachLengthM',
  'boardOffsetCm',
  'poleLengthM',
  'poleStiffnessLb',
  'gripHeightM',
  'standardsCm',
] as const satisfies readonly DetailKey[];

export const EMPTY_DETAILS: AttemptDetails = {
  approachSteps: null,
  approachLengthM: null,
  boardOffsetCm: null,
  poleLengthM: null,
  poleStiffnessLb: null,
  gripHeightM: null,
  standardsCm: null,
};

const APPROACH = ['approachSteps', 'approachLengthM'] as const;

/**
 * 種目ごとに持つ欄。走高跳は助走だけ（高さごとの ○×– は別に作る）。
 * 踏切板は走幅跳と三段跳だけ、ポールの欄は棒高跳だけ
 */
const FIELDS: Record<JumpEvent, readonly DetailKey[]> = {
  high_jump: APPROACH,
  long_jump: [...APPROACH, 'boardOffsetCm'],
  triple_jump: [...APPROACH, 'boardOffsetCm'],
  pole_vault: [...APPROACH, 'poleLengthM', 'poleStiffnessLb', 'gripHeightM', 'standardsCm'],
};

export function detailFieldsFor(event: JumpEvent): readonly DetailKey[] {
  return FIELDS[event];
}

/** 種目に合わない欄を空にする。種目を変えて直した試技に、前の種目の欄が残らないように */
export function keepDetailsFor(event: JumpEvent, details: AttemptDetails): AttemptDetails {
  const fields = FIELDS[event];
  return Object.fromEntries(
    DETAIL_KEYS.map((key) => [key, fields.includes(key) ? details[key] : null]),
  ) as AttemptDetails;
}

/** 1つでも入っているか */
export function hasDetails(details: AttemptDetails): boolean {
  return DETAIL_KEYS.some((key) => details[key] !== null);
}

/**
 * 欄ごとの範囲（DB の単位。db/migrations/0024_attempt_details.sql の check と同じ値）。
 * 画面の欄の min・max、サーバーの検査、範囲の外のときの文言で同じものを使う
 */
export const DETAIL_RANGES = {
  approachSteps: { min: APPROACH_STEPS_MIN, max: APPROACH_STEPS_MAX },
  approachLengthM: { min: APPROACH_LENGTH_MIN_M, max: APPROACH_LENGTH_MAX_M },
  boardOffsetCm: { min: BOARD_OFFSET_MIN_CM, max: BOARD_OFFSET_MAX_CM },
  poleLengthM: { min: POLE_LENGTH_MIN_M, max: POLE_LENGTH_MAX_M },
  poleStiffnessLb: { min: POLE_STIFFNESS_MIN_LB, max: POLE_STIFFNESS_MAX_LB },
  gripHeightM: { min: GRIP_HEIGHT_MIN_M, max: GRIP_HEIGHT_MAX_M },
  standardsCm: { min: STANDARDS_MIN_CM, max: STANDARDS_MAX_CM },
} as const satisfies Record<DetailKey, { min: number; max: number }>;

const R = DETAIL_RANGES;

/** 送られてきた細かい記録の検査。画面の欄と同じ範囲。グリップはポールの長さを超えない */
export const attemptDetailsSchema = z
  .object({
    approachSteps: optionalInteger(R.approachSteps.min, R.approachSteps.max),
    approachLengthM: optionalNumber(R.approachLengthM.min, R.approachLengthM.max),
    boardOffsetCm: optionalNumber(R.boardOffsetCm.min, R.boardOffsetCm.max),
    poleLengthM: optionalNumber(R.poleLengthM.min, R.poleLengthM.max),
    poleStiffnessLb: optionalInteger(R.poleStiffnessLb.min, R.poleStiffnessLb.max),
    gripHeightM: optionalNumber(R.gripHeightM.min, R.gripHeightM.max),
    standardsCm: optionalNumber(R.standardsCm.min, R.standardsCm.max),
  })
  .refine(
    (d) => d.gripHeightM === null || d.poleLengthM === null || d.gripHeightM <= d.poleLengthM,
    { message: 'grip', path: ['gripHeightM'] },
  );

/** 範囲の外の欄の文言の鍵（errors.detailRange.*） */
export type DetailError = `detailRange.${DetailKey}` | 'grip';

/**
 * 弾いた理由を、画面の文言の鍵にする。どの欄が範囲の外かを言う（「詳細を確かめて」では、どれかわからない）。
 * グリップがポールより高いときは grip
 */
export function detailsError(error: z.ZodError | undefined): DetailError {
  const issue = error?.issues[0];
  if (issue?.message === 'grip') return 'grip';
  const key = DETAIL_KEYS.find((k) => k === issue?.path[0]) ?? DETAIL_KEYS[0];
  return `detailRange.${key}`;
}
