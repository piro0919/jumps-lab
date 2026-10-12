import { describe, expect, it } from 'vitest';
import { checkMenu, LIMITS, type Menu, type MenuItem, menuTotals } from '@/lib/menu';

function item(over: Partial<MenuItem> = {}): MenuItem {
  return {
    at: null,
    name: 'x',
    purpose: '',
    sets: null,
    reps: null,
    intensity: '',
    minutes: 10,
    takeoffs: 0,
    contacts: 0,
    reason: '',
    ...over,
  };
}

function menu(...items: MenuItem[]): Menu {
  return { summary: '', sections: [{ kind: 'technique', items }], cautions: [], missing: [] };
}

describe('menuTotals', () => {
  it('区分をまたいで本数と分を足す', () => {
    const m: Menu = {
      summary: '',
      sections: [
        { kind: 'warmup', items: [item({ minutes: 15 })] },
        { kind: 'technique', items: [item({ takeoffs: 8, minutes: 30 }), item({ contacts: 40 })] },
      ],
      cautions: [],
      missing: [],
    };
    expect(menuTotals(m)).toEqual({ takeoffs: 8, contacts: 40, minutes: 55 });
  });
});

describe('checkMenu', () => {
  it('上限ちょうどは通す', () => {
    const { takeoffs, contacts } = LIMITS.normal;
    expect(checkMenu(menu(item({ takeoffs, contacts })), 'normal', 90)).toBeNull();
  });

  it('跳躍が上限を1本でも超えたら出さない', () => {
    expect(checkMenu(menu(item({ takeoffs: LIMITS.preMeet.takeoffs + 1 })), 'preMeet', 90)).toMatch(
      /takeoffs/,
    );
  });

  it('接地が上限を超えたら出さない', () => {
    expect(checkMenu(menu(item({ contacts: LIMITS.lighter.contacts + 1 })), 'lighter', 90)).toMatch(
      /contacts/,
    );
  });

  // 痛みの記入がある日は跳ばない
  it('患部を守る日は跳躍も接地も1つも許さない', () => {
    expect(LIMITS.protect).toEqual({ takeoffs: 0, contacts: 0 });
    expect(checkMenu(menu(item({ takeoffs: 1 })), 'protect', 60)).not.toBeNull();
    expect(checkMenu(menu(item({ contacts: 1 })), 'protect', 60)).not.toBeNull();
    expect(checkMenu(menu(item()), 'protect', 60)).toBeNull();
  });

  it('強さが下がるほど上限は増えない', () => {
    const order = ['normal', 'lighter', 'preMeet', 'protect'] as const;
    for (let i = 1; i < order.length; i += 1) {
      expect(LIMITS[order[i]!].takeoffs).toBeLessThanOrEqual(LIMITS[order[i - 1]!].takeoffs);
      expect(LIMITS[order[i]!].contacts).toBeLessThanOrEqual(LIMITS[order[i - 1]!].contacts);
    }
  });

  it('負の数と、空のメニューは出さない', () => {
    expect(checkMenu(menu(item({ takeoffs: -5 })), 'normal', 90)).not.toBeNull();
    expect(checkMenu(menu(), 'normal', 90)).not.toBeNull();
  });

  it('練習時間は2割まで超えてよい', () => {
    expect(checkMenu(menu(item({ minutes: 108 })), 'normal', 90)).toBeNull();
    expect(checkMenu(menu(item({ minutes: 109 })), 'normal', 90)).toMatch(/minutes/);
  });
});
