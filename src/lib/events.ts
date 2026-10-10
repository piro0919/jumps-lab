/** 種目。DB の check と同じ並び */
export const EVENTS = ['high_jump', 'long_jump', 'triple_jump', 'pole_vault'] as const;

export type JumpEvent = (typeof EVENTS)[number];

export function isJumpEvent(value: unknown): value is JumpEvent {
  return EVENTS.includes(value as JumpEvent);
}

/**
 * 風速を測る種目か。陸上の規則で、風を記録に残すのは走幅跳と三段跳だけ
 * （走高跳と棒高跳は風の影響を記録に付けない）
 */
export function hasWind(event: JumpEvent): boolean {
  return event === 'long_jump' || event === 'triple_jump';
}
