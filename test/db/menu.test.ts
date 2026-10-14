import { describe, expect, it } from 'vitest';
import {
  claimAiCall,
  countAiCalls,
  getMenu,
  hasMenu,
  listMenuMessages,
  recordAiCall,
  saveMenu,
  saveMenuExchange,
} from '@/lib/data';
import type { Menu } from '@/lib/menu';
import { addProfile } from './seed';

/** AI コーチの表（呼んだ回数・今日のメニュー・チャット） */

const DAY = '2026-10-14';

function menu(summary: string): Menu {
  return { summary, sections: [], cautions: [], missing: [] };
}

const first = { level: 'normal' as const, model: 'model-a', menu: menu('first'), minutes: 90 };

describe('countAiCalls', () => {
  it('その日の分と同じ月の分を、種類ごとに本人の分だけ数える', async () => {
    const [userId, other] = await Promise.all([addProfile(), addProfile()]);
    await recordAiCall(userId, DAY, 'menu', 'm');
    await recordAiCall(userId, DAY, 'menu', 'm');
    await recordAiCall(userId, DAY, 'chat', 'm');
    await recordAiCall(userId, '2026-10-01', 'menu', 'm');
    await recordAiCall(userId, '2026-10-31', 'menu', 'm');
    // 前の月と次の月は数えない
    await recordAiCall(userId, '2026-09-30', 'menu', 'm');
    await recordAiCall(userId, '2026-11-01', 'menu', 'm');
    await recordAiCall(other, DAY, 'menu', 'm');

    expect(await countAiCalls(userId, DAY, 'menu')).toEqual({ today: 2, month: 4 });
    expect(await countAiCalls(userId, DAY, 'chat')).toEqual({ today: 1, month: 1 });
    expect(await countAiCalls(userId, '2026-10-02', 'menu')).toEqual({ today: 0, month: 4 });
  });
});

describe('claimAiCall', () => {
  it('同時に送られても、その日の上限の数だけ記録して通す', async () => {
    const userId = await addProfile();
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        claimAiCall(userId, DAY, 'meetImport', 'm', { perDay: 2, perMonth: 10 }),
      ),
    );
    expect({
      passed: results.filter(Boolean).length,
      recorded: await countAiCalls(userId, DAY, 'meetImport'),
    }).toEqual({ passed: 2, recorded: { today: 2, month: 2 } });
  });

  it('月の上限に達していれば、その日がまだでも通さない', async () => {
    const userId = await addProfile();
    await recordAiCall(userId, '2026-10-01', 'meetImport', 'm');
    expect(await claimAiCall(userId, DAY, 'meetImport', 'm', { perDay: 5, perMonth: 1 })).toBe(
      false,
    );
  });
});

describe('saveMenu', () => {
  it('1日に1つ。2つ目は保存せず false を返し、初めのメニューを残す', async () => {
    const userId = await addProfile();
    expect(await hasMenu(userId, DAY)).toBe(false);
    expect(await saveMenu(userId, DAY, first)).toBe(true);
    expect(await saveMenu(userId, DAY, { ...first, menu: menu('second') })).toBe(false);
    expect(await getMenu(userId, DAY)).toEqual({ ...first, version: 1 });
    expect(await hasMenu(userId, DAY)).toBe(true);
  });

  it('同時に2回押しても、保存できるのは1つ', async () => {
    const userId = await addProfile();
    const results = await Promise.all([saveMenu(userId, DAY, first), saveMenu(userId, DAY, first)]);
    expect(results.toSorted()).toEqual([false, true]);
  });

  it('ほかの人のメニューは見えない', async () => {
    const [userId, other] = await Promise.all([addProfile(), addProfile()]);
    await saveMenu(other, DAY, first);
    expect(await getMenu(userId, DAY)).toBeNull();
    expect(await hasMenu(userId, DAY)).toBe(false);
  });
});

describe('saveMenuExchange', () => {
  it('直した返事は版を上げてメニューを上書きし、相談と返事を相談が先の順で残す', async () => {
    const userId = await addProfile();
    await saveMenu(userId, DAY, first);
    const revised = {
      level: 'lighter' as const,
      model: 'model-b',
      menu: menu('revised'),
      minutes: 60,
    };
    expect(
      await saveMenuExchange(userId, DAY, { fromVersion: 1, question: 'q', reply: 'r', revised }),
    ).toBe(true);

    expect(await getMenu(userId, DAY)).toEqual({ ...revised, version: 2 });
    const messages = await listMenuMessages(userId, DAY);
    expect(messages.map(({ role, content, version }) => ({ role, content, version }))).toEqual([
      { role: 'user', content: 'q', version: null },
      { role: 'assistant', content: 'r', version: 2 },
    ]);
  });

  it('直さなかった返事は版もメニューも変えない', async () => {
    const userId = await addProfile();
    await saveMenu(userId, DAY, first);
    expect(
      await saveMenuExchange(userId, DAY, {
        fromVersion: 1,
        question: 'q',
        reply: 'r',
        revised: null,
      }),
    ).toBe(true);
    expect(await getMenu(userId, DAY)).toEqual({ ...first, version: 1 });
    expect((await listMenuMessages(userId, DAY)).map((m) => m.version)).toEqual([null, null]);
  });

  it('読んだ版から変わっていたら何も保存しない', async () => {
    const userId = await addProfile();
    await saveMenu(userId, DAY, first);
    const revised = { ...first, menu: menu('revised') };
    await saveMenuExchange(userId, DAY, { fromVersion: 1, question: 'a', reply: 'a', revised });

    expect(
      await saveMenuExchange(userId, DAY, {
        fromVersion: 1,
        question: 'b',
        reply: 'b',
        revised: { ...first, menu: menu('stale') },
      }),
    ).toBe(false);
    expect((await getMenu(userId, DAY))?.menu.summary).toBe('revised');
    expect((await listMenuMessages(userId, DAY)).map((m) => m.content)).toEqual(['a', 'a']);
  });

  it('同じ版から同時に直すと、後の方を捨てる', async () => {
    const userId = await addProfile();
    await saveMenu(userId, DAY, first);
    const exchange = (summary: string) =>
      saveMenuExchange(userId, DAY, {
        fromVersion: 1,
        question: summary,
        reply: summary,
        revised: { ...first, menu: menu(summary) },
      });
    const results = await Promise.all([exchange('x'), exchange('y')]);

    expect(results.toSorted()).toEqual([false, true]);
    const saved = await getMenu(userId, DAY);
    expect(saved?.version).toBe(2);
    expect(await listMenuMessages(userId, DAY)).toHaveLength(2);
  });

  it('メニューの無い日やほかの人のメニューには保存しない', async () => {
    const [userId, other] = await Promise.all([addProfile(), addProfile()]);
    await saveMenu(other, DAY, first);
    expect(
      await saveMenuExchange(userId, DAY, {
        fromVersion: 1,
        question: 'q',
        reply: 'r',
        revised: { ...first, menu: menu('hijack') },
      }),
    ).toBe(false);
    expect((await getMenu(other, DAY))?.menu.summary).toBe('first');
    expect(await listMenuMessages(other, DAY)).toEqual([]);
  });
});
