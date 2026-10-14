/** 学年の選択肢。値は言語によらない鍵で持ち、表示は messages の grades で引く */
export const GRADES = [
  'jh1',
  'jh2',
  'jh3',
  'hs1',
  'hs2',
  'hs3',
  'univ1',
  'univ2',
  'univ3',
  'univ4',
  'adult',
] as const;

export type Grade = (typeof GRADES)[number];

/** プラン。AI の機能は premium だけ（src/lib/ai.ts の aiEnabled）。名前の Free / Premium は仮 */
export const PLANS = ['free', 'premium'] as const;

export type Plan = (typeof PLANS)[number];

/**
 * チームのプラン（2026-10-15）。team のチームの選手は、自分のプランが free でも AI の機能を使える
 * （src/lib/ai.ts の aiEnabled）。課金ができるまでは管理の画面で切り替える
 */
export const TEAM_PLANS = ['free', 'team'] as const;

export type TeamPlan = (typeof TEAM_PLANS)[number];
