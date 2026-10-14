import { redirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommentWrite } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { COMMENT_MAX_LENGTH } from '@/lib/limits';

/**
 * コメントを書く Server Action（src/app/actions/comments.ts の addCommentAction）。DB と知らせは差し替える:
 * 1. 字数の上限・空の文は書かない。書けない（denied）は generic、書きすぎ（limit）は commentLimit
 * 2. 選手は自分の日に、コーチはいまの選手の日に書き、書けたら after() で相手への知らせを送る
 * 3. 書く途中で投げられた Next の redirect は、誤りの値にせず投げ直す
 * 書けるか（コーチか・いまの選手か・書ける日か・数）は書く文の中で確かめる（test/db/comments.test.ts）
 */

vi.mock('next/cache', () => ({ refresh: vi.fn() }));
const server = vi.hoisted(() => ({ after: vi.fn<(task: () => Promise<void>) => void>() }));
vi.mock('next/server', () => server);
vi.mock('@/lib/viewer', () => ({
  requireViewer: async () => ({ userId: 'me', name: 'Me', email: 'me@example.com', image: null }),
}));
const data = vi.hoisted(() => ({
  addCommentAsAthlete: vi.fn<(...args: unknown[]) => Promise<CommentWrite>>(async () => 'ok'),
  addCommentAsCoach: vi.fn<(...args: unknown[]) => Promise<CommentWrite>>(async () => 'ok'),
  deleteComment: vi.fn(async () => true),
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
  it('長すぎる・空の文は comment で、書かない', async () => {
    const results = [
      await addCommentAction(null, form({ body: 'a'.repeat(COMMENT_MAX_LENGTH + 1) })),
      await addCommentAction(null, form({ body: '   ' })),
    ];
    expect({
      results,
      writes: data.addCommentAsAthlete.mock.calls.length + data.addCommentAsCoach.mock.calls.length,
    }).toEqual({
      results: [
        { ok: false, error: 'comment' },
        { ok: false, error: 'comment' },
      ],
      writes: 0,
    });
  });

  it('書けなければ generic、直近24時間に書きすぎていれば commentLimit。どちらも知らせを送らない', async () => {
    data.addCommentAsAthlete.mockResolvedValueOnce('denied');
    data.addCommentAsAthlete.mockResolvedValueOnce('limit');
    data.addCommentAsCoach.mockResolvedValueOnce('limit');
    expect({
      results: [
        await addCommentAction(null, form({ day: '2000-01-01' })),
        await addCommentAction(null, form({})),
        await addCommentAction(null, form({ athleteId: 'athlete' })),
      ],
      scheduled: server.after.mock.calls.length,
    }).toEqual({
      results: [
        { ok: false, error: 'generic' },
        { ok: false, error: 'commentLimit' },
        { ok: false, error: 'commentLimit' },
      ],
      scheduled: 0,
    });
  });

  it('書く途中で投げられた redirect は、誤りの値にせず投げ直す', async () => {
    data.addCommentAsAthlete.mockImplementationOnce(async () => redirect('/welcome'));
    await expect(addCommentAction(null, form({}))).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
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

  it('コーチは選手の id を付けて1つの文で書く。いまの選手でなければ書けず、知らせも送らない', async () => {
    const written = await addCommentAction(null, form({ athleteId: 'athlete' }));
    data.addCommentAsCoach.mockResolvedValueOnce('denied');
    const refused = await addCommentAction(null, form({ athleteId: 'stranger' }));
    expect({
      written,
      refused,
      writes: data.addCommentAsCoach.mock.calls.map((call) => call[0]),
      scheduled: server.after.mock.calls.length,
    }).toEqual({
      written: { ok: true },
      refused: { ok: false, error: 'generic' },
      writes: [
        { coachId: 'me', teamId: TEAM, memberId: 'athlete' },
        { coachId: 'me', teamId: TEAM, memberId: 'stranger' },
      ],
      scheduled: 1,
    });
  });
});
