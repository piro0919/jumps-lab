import { describe, expect, it } from 'vitest';
import { cleanMeets, draftHref, MEET_IMPORT_MAX_MEETS, readDraft } from '@/lib/meet-import';

const TODAY = '2026-10-15';

const meet = (fields: Record<string, unknown>) => ({
  name: '県選手権',
  day: '2026-11-01',
  venue: null,
  callRoomPlace: null,
  callRoomTime: null,
  startTime: null,
  entryUrl: null,
  notes: null,
  ...fields,
});

describe('cleanMeets', () => {
  it('keeps upcoming meets with a real date, sorted by day', () => {
    const meets = cleanMeets(
      {
        meets: [
          meet({ name: 'B', day: '2026-12-01' }),
          meet({ name: 'A', day: '2026-10-15', venue: ' 平和台 ', callRoomTime: '09:30' }),
        ],
      },
      TODAY,
    );
    expect(meets.map((m) => [m.name, m.day, m.venue, m.callRoomTime])).toEqual([
      ['A', '2026-10-15', '平和台', '09:30'],
      ['B', '2026-12-01', null, null],
    ]);
  });

  it('drops past days, impossible dates, far future and nameless meets', () => {
    const meets = cleanMeets(
      {
        meets: [
          meet({ day: '2026-10-14' }),
          meet({ day: '2026-02-30' }),
          meet({ day: '2026/11/01' }),
          meet({ day: '2029-01-01' }),
          meet({ name: '  ' }),
        ],
      },
      TODAY,
    );
    expect(meets).toEqual([]);
  });

  it('drops bad times and non-http links, and merges duplicates', () => {
    const meets = cleanMeets(
      {
        meets: [
          meet({ startTime: '25:00', callRoomTime: '9:30', entryUrl: 'javascript:alert(1)' }),
          meet({ entryUrl: 'https://example.com/a' }),
        ],
      },
      TODAY,
    );
    expect(meets).toEqual([meet({})]);
  });

  it('returns nothing for a malformed answer', () => {
    expect([cleanMeets(null, TODAY), cleanMeets({ meets: 'x' }, TODAY)]).toEqual([[], []]);
  });

  it('caps the list', () => {
    const many = Array.from({ length: MEET_IMPORT_MAX_MEETS + 5 }, (_, i) =>
      meet({ name: `Meet ${String(i).padStart(3, '0')}` }),
    );
    expect(cleanMeets({ meets: many }, TODAY)).toHaveLength(MEET_IMPORT_MAX_MEETS);
  });
});

describe('draft URLs', () => {
  it('round-trips a meet through the add page URL', () => {
    const imported = cleanMeets(
      {
        meets: [
          meet({
            venue: '博多の森',
            startTime: '10:00',
            entryUrl: 'https://example.com/entry?x=1&y=2',
            notes: '2日間',
          }),
        ],
      },
      TODAY,
    )[0]!;
    const href = draftHref(imported);
    const params = Object.fromEntries(new URL(href, 'https://jumpslab.kkweb.io').searchParams);
    expect([href.startsWith('/competitions/new?from=import'), readDraft(params)]).toEqual([
      true,
      imported,
    ]);
  });

  it('refuses a draft without a name or a real date, and cleans the rest', () => {
    expect([
      readDraft({ name: 'X' }),
      readDraft({ name: '', day: '2026-11-01' }),
      readDraft({ name: 'X', day: '2026-02-30' }),
      readDraft({ name: 'X', day: '2026-11-01', entryUrl: 'javascript:alert(1)', startTime: 'x' }),
    ]).toEqual([
      null,
      null,
      null,
      {
        name: 'X',
        day: '2026-11-01',
        venue: null,
        callRoomPlace: null,
        callRoomTime: null,
        startTime: null,
        entryUrl: null,
        notes: null,
      },
    ]);
  });
});
