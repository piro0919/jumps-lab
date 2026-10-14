import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 招待のリンクから入る Server Action（src/app/actions/teams.ts の joinTeamAction）が、
 * DB の判定（src/lib/data.ts の joinTeamBySelf）を画面が切り替えられる値で返すか。DB は差し替える
 */

vi.mock('@/env', () => ({ env: { BETTER_AUTH_URL: 'http://localhost:3312' } }));
vi.mock('next/cache', () => ({ refresh: vi.fn() }));
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect ${path}`);
  }),
}));
vi.mock('next/navigation', () => navigation);
vi.mock('@/lib/viewer', () => ({
  requireViewer: async () => ({ userId: 'u1', name: 'Taro', email: 't@example.com', image: null }),
  requireProfile: async () => ({}),
}));
const data = vi.hoisted(() => ({
  joinTeamBySelf: vi.fn(
    async (): Promise<'joined' | 'already' | 'invalid' | 'coach' | 'guardian' | 'ask'> => 'joined',
  ),
}));
vi.mock('@/lib/data', () => data);

const { joinTeamAction } = await import('@/app/actions/teams');

const form = () => {
  const formData = new FormData();
  formData.set('token', 'invite-token');
  return formData;
};

beforeEach(() => {
  data.joinTeamBySelf.mockClear();
});

describe('joinTeamAction', () => {
  it('年齢で断られたら、保護者の欄か年齢の問いに切り替えられる誤りを返す。コーチ・使えない招待もそれと分かる誤り', async () => {
    const results = [];
    for (const outcome of ['guardian', 'ask', 'coach', 'invalid'] as const) {
      data.joinTeamBySelf.mockResolvedValueOnce(outcome);
      results.push(await joinTeamAction(null, form()));
    }
    expect(results).toEqual([
      { ok: false, error: 'teamNeedsGuardian' },
      { ok: false, error: 'teamAskAge' },
      { ok: false, error: 'teamCoachJoin' },
      { ok: false, error: 'teamInviteInvalid' },
    ]);
  });

  it('入れたら（もう入っていても）チームの一覧へ', async () => {
    await expect(joinTeamAction(null, form())).rejects.toThrow('redirect /teams');
    data.joinTeamBySelf.mockResolvedValueOnce('already');
    await expect(joinTeamAction(null, form())).rejects.toThrow('redirect /teams');
  });
});
