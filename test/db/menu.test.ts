import { describe, expect, it } from 'vitest';
import {
  type AiCallKind,
  claimAiCall,
  getMenu,
  hasMenu,
  listMenuMessages,
  saveMenu,
  saveMenuExchange,
} from '@/lib/data';
import type { Menu } from '@/lib/menu';
import { addProfile, query } from './seed';

/** AI コーチの表（呼んだ回数・今日のメニュー・チャット） */

const DAY = '2026-10-14';

function menu(summary: string): Menu {
  return { summary, sections: [], cautions: [], missing: [] };
}

const first = { level: 'normal' as const, model: 'model-a', menu: menu('first'), minutes: 90 };

/** 上限に関わらず、AI を呼んだ記録を1行入れる */
async function record(userId: string, day: string, kind: AiCallKind) {
  await query(`insert into ai_call ("userId", day, kind, model) values ($1, $2, $3, 'm')`, [
    userId,
    day,
    kind,
  ]);
}

describe('claimAiCall', () => {
  it('その日の分と同じ月の分を、種類ごとに本人の分だけ数える', async () => {
    const [userId, other] = await Promise.all([addProfile(), addProfile()]);
    await record(userId, DAY, 'menu');
    await record(userId, DAY, 'menu');
    await record(userId, DAY, 'chat');
    await record(userId, '2026-10-01', 'menu');
    await record(userId, '2026-10-31', 'menu');
    // 前の月と次の月は数えない
    await record(userId, '2026-09-30', 'menu');
    await record(userId, '2026-11-01', 'menu');
    await record(other, DAY, 'menu');

    // 断るものを先に確かめる（通ると1行増える）
    const results = [
      // その日は 2回
      await claimAiCall(userId, DAY, 'menu', 'm', { perDay: 2, perMonth: 99 }),
      // 月は 4回
      await claimAiCall(userId, '2026-10-02', 'menu', 'm', { perDay: 9, perMonth: 4 }),
      await claimAiCall(userId, '2026-10-02', 'menu', 'm', { perDay: 1, perMonth: 5 }),
      // 相談は 1回だけ
      await claimAiCall(userId, DAY, 'chat', 'm', { perDay: 2, perMonth: 2 }),
    ];
    expect(results).toEqual([false, false, true, true]);
  });

  it('同時に送られても、その日の上限の数だけ記録して通す', async () => {
    const userId = await addProfile();
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        claimAiCall(userId, DAY, 'meetImport', 'm', { perDay: 2, perMonth: 10 }),
      ),
    );
    expect({
      passed: results.filter(Boolean).length,
      recorded: (
        await query<{ n: number }>(
          `select count(*)::integer as n from ai_call where "userId" = $1`,
          [userId],
        )
      )[0]!.n,
    }).toEqual({ passed: 2, recorded: 2 });
  });

  it('月の上限に達していれば、その日がまだでも通さない', async () => {
    const userId = await addProfile();
    await record(userId, '2026-10-01', 'meetImport');
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
