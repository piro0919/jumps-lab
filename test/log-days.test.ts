import { describe, expect, it } from 'vitest';
import { buildLogDays } from '@/lib/log-days';

describe('buildLogDays', () => {
  it('記録も体調も無ければ空', () => {
    expect(buildLogDays([], [])).toEqual([]);
  });

  it('記録か体調のある日を、新しい日から並べる', () => {
    const days = buildLogDays(
      [
        { day: '2026-10-09', event: 'high_jump', markM: 1.75 },
        { day: '2026-10-09', event: 'high_jump', markM: 1.8 },
        { day: '2026-10-09', event: 'long_jump', markM: 6.2 },
        { day: '2026-10-11', event: 'high_jump', markM: 1.82 },
      ],
      [
        { day: '2026-10-10', condition: 6, note: null },
        { day: '2026-10-11', condition: 8, note: '踏切が良かった' },
      ],
    );
    expect(days).toEqual([
      {
        day: '2026-10-11',
        events: [{ event: 'high_jump', count: 1, bestM: 1.82 }],
        condition: 8,
        hasNote: true,
      },
      { day: '2026-10-10', events: [], condition: 6, hasNote: false },
      {
        day: '2026-10-09',
        events: [
          { event: 'high_jump', count: 2, bestM: 1.8 },
          { event: 'long_jump', count: 1, bestM: 6.2 },
        ],
        condition: null,
        hasNote: false,
      },
    ]);
  });
});
