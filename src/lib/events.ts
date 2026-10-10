/** 種目。DB の check と同じ並び */
export const EVENTS = ['high_jump', 'long_jump', 'triple_jump', 'pole_vault'] as const;

/** アドレスに出す種目の名前（high_jump → high-jump）。目標とベストを直す画面 /targets/[event] で使う */
export function eventSlug(event: (typeof EVENTS)[number]): string {
  return event.replace('_', '-');
}

/** アドレスの種目の名前から種目へ。知らない名前は null */
export function eventFromSlug(slug: string): (typeof EVENTS)[number] | null {
  return EVENTS.find((event) => eventSlug(event) === slug) ?? null;
}

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

/**
 * 追い風参考か。追い風が 2.0 m/s を超えた記録は公認されない（陸上の規則。走幅跳・三段跳）。
 * 風速を入れていない記録は判定できないので、参考にしない
 */
export function isWindAided(windMs: number | null): boolean {
  return windMs !== null && windMs > 2.0;
}

/** 種目の色（globals.css）。色付きのカードの地に使い、上の字は白にする */
export const EVENT_BG: Record<JumpEvent, string> = {
  high_jump: 'bg-high-jump',
  long_jump: 'bg-long-jump',
  triple_jump: 'bg-triple-jump',
  pole_vault: 'bg-pole-vault',
};

/**
 * 種目の色の字。明るいテーマは EVENT_BG と同じ色で、白い地の上で 4.5 を超える。
 * 暗いテーマでは明るい色に替わる（globals.css の --*-ink）
 */
export const EVENT_TEXT: Record<JumpEvent, string> = {
  high_jump: 'text-high-jump-ink',
  long_jump: 'text-long-jump-ink',
  triple_jump: 'text-triple-jump-ink',
  pole_vault: 'text-pole-vault-ink',
};

/** 種目の英字の略。カードの隅に大きく透かして置く飾りなど（言語によらない） */
export const EVENT_MARK: Record<JumpEvent, string> = {
  high_jump: 'HJ',
  long_jump: 'LJ',
  triple_jump: 'TJ',
  pole_vault: 'PV',
};
