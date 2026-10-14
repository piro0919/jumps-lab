import { beforeEach, describe, expect, it, vi } from 'vitest';
import { todayIn } from '@/lib/dates';
import { COMMENT_MAX_LENGTH } from '@/lib/limits';

/**
 * コメントを書く Server Action（src/app/actions/comments.ts の addCommentAction）。DB と知らせは差し替える:
 * 1. 字数の上限・空の文・書けない日は書かない
 * 2. 選手は自分の日に、コーチはいまの選手の日に書き、書けたら after() で相手への知らせを送る
 */

vi.mock('next/cache', () => ({ refresh: vi.fn() }));
const server = vi.hoisted(() => ({ after: vi.fn<(task: () => Promise<void>) => void>() }));
vi.mock('next/server', () => server);
vi.mock('@/lib/viewer', () => ({
  requireViewer: async () => ({ userId: 'me', name: 'Me', email: 'me@example.com', image: null }),
  requireProfile: async () => ({ timeZone: 'UTC' }),
}));
const data = vi.hoisted(() => ({
  addCommentAsAthlete: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true),
  addCommentAsCoach: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true),
  deleteComment: vi.fn(async () => true),
  getMemberForCoach: vi.fn(async (): Promise<{ timeZone: string } | null> => ({ timeZone: 'UTC' })),
}));
vi.mock('@/lib/data', () => data);
const push = vi.hoisted(() => ({ sendCommentPush: vi.fn(async () => ({ sent: 1, failed: 0 })) }));
vi.mock('@/lib/push', () => push);

const { addCommentAction } = await import('@/app/actions/comments');

const TEAM = '11111111-1111-4111-8111-111111111111';
const today = () => todayIn('UTC');

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries({
    teamId: TEAM,
    day: today(),
    body: 'Nice',
    ...fields,
  }))
    formData.set(key, value);
  return formData;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('addCommentAction', () => {
  it('長すぎる・空の文は comment、書けない日（15日前・先の日）は generic で、どれも書かない', async () => {
    const results = [
      await addCommentAction(null, form({ body: 'a'.repeat(COMMENT_MAX_LENGTH + 1) })),
      await addCommentAction(null, form({ body: '   ' })),
      await addCommentAction(null, form({ day: '2000-01-01' })),
      await addCommentAction(null, form({ day: '2999-01-01' })),
    ];
    expect({
      results,
      writes: data.addCommentAsAthlete.mock.calls.length + data.addCommentAsCoach.mock.calls.length,
    }).toEqual({
      results: [
        { ok: false, error: 'comment' },
        { ok: false, error: 'comment' },
        { ok: false, error: 'generic' },
        { ok: false, error: 'generic' },
      ],
      writes: 0,
    });
  });

  it('選手は自分の日に書き、書けたら知らせを after() で送る（書いた人は自分）', async () => {
    const result = await addCommentAction(null, form({ body: '  Thanks  ' }));
    await server.after.mock.calls[0]![0]();
    expect({
      result,
      write: data.addCommentAsAthlete.mock.calls[0],
      push: push.sendCommentPush.mock.calls[0],
    }).toEqual({
      result: { ok: true },
      write: ['me', TEAM, today(), 'Thanks'],
      push: [{ teamId: TEAM, athleteId: 'me', authorId: 'me', day: today() }],
    });
  });

  it('コーチは選手の id を付けて書く。いまの選手でなければ書かず、知らせも送らない', async () => {
    const written = await addCommentAction(null, form({ athleteId: 'athlete' }));
    data.getMemberForCoach.mockResolvedValueOnce(null);
    const refused = await addCommentAction(null, form({ athleteId: 'stranger' }));
    expect({
      written,
      refused,
      writes: data.addCommentAsCoach.mock.calls.map((call) => call[0]),
      scheduled: server.after.mock.calls.length,
    }).toEqual({
      written: { ok: true },
      refused: { ok: false, error: 'generic' },
      writes: [{ coachId: 'me', teamId: TEAM, memberId: 'athlete' }],
      scheduled: 1,
    });
  });
});
