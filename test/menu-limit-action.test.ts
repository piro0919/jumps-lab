import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/lib/data';

/**
 * メニューと相談の Server Action（src/app/actions/menu.ts）が、AI を呼ぶ前に
 * 回数の上限を claimAiCallWithinLimit で取ること（数えると記録が別々だと、同時に送られて上限を超えた）
 */

vi.mock('@/env', () => ({ env: { OPENAI_API_KEY: 'sk-test' } }));
vi.mock('next/cache', () => ({ refresh: vi.fn() }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'ja' }));
vi.mock('@/lib/viewer', () => ({
  requireViewer: async () => ({
    userId: 'u1',
    name: 'Taro',
    email: 'taro@example.com',
    image: null,
  }),
}));

const profile = vi.hoisted(() => ({ current: null as Profile | null }));
const data = vi.hoisted(() => ({
  getProfile: vi.fn(async () => profile.current),
  getMenu: vi.fn(async (): Promise<unknown> => null),
  listConditionsBetween: vi.fn(async () => []),
  listCompetitionsBetween: vi.fn(async () => []),
  listAttemptMarksBetween: vi.fn(async () => []),
  listAllAttempts: vi.fn(async () => []),
  getTargets: vi.fn(async () => new Map()),
  listMenuMessages: vi.fn(async () => []),
  saveMenu: vi.fn(async () => {}),
  saveMenuExchange: vi.fn(async () => true),
  consentToAi: vi.fn(async () => true),
}));
vi.mock('@/lib/data', () => data);

const limit = vi.hoisted(() => ({
  claimAiCallWithinLimit: vi.fn<
    (userId: string, today: string, kind: string, model: string) => Promise<boolean>
  >(async () => true),
}));
vi.mock('@/lib/ai-limit', () => limit);

const askJson = vi.hoisted(() => vi.fn(async (): Promise<unknown> => ({ items: [] })));
vi.mock('@/lib/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai')>()),
  askJson,
}));
// 上限の確認だけを見るので、メニューの中身の検査は毎回「作り直し」を返す
vi.mock('@/lib/menu', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/menu')>()),
  checkMenu: () => 'Too many take-offs.',
}));

const { createMenuAction, askMenuAction } = await import('@/app/actions/menu');
const { AI_CONSENT_VERSION } = await import('@/lib/ai');
const { CHAT_MODEL, MENU_MODEL } = await import('@/lib/menu');

const adult: Profile = {
  name: 'Taro',
  grade: null,
  gradeOffset: 0,
  birthdate: '2000-05-01',
  gender: null,
  heightCm: null,
  weightKg: null,
  events: ['long_jump'],
  units: 'metric',
  seasonStartMonth: 1,
  weekStart: 0,
  timeZone: 'Asia/Tokyo',
  plan: 'premium',
  inTeamPlan: false,
  aiConsentVersion: AI_CONSENT_VERSION,
  aiGuardianConsentVersion: null,
  ageDeclared16Plus: true,
};

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

const savedMenu = {
  level: 'normal',
  version: 1,
  minutes: 60,
  menu: { items: [], meetDay: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  profile.current = adult;
  data.getMenu.mockResolvedValue(null);
  limit.claimAiCallWithinLimit.mockResolvedValue(true);
});

describe('createMenuAction', () => {
  it('上限に達していれば AI を呼ばずに menuLimit を返す', async () => {
    limit.claimAiCallWithinLimit.mockResolvedValue(false);
    const result = await createMenuAction({ ok: true }, form({ minutes: '60' }));
    expect({
      result,
      asked: askJson.mock.calls.length,
      claims: limit.claimAiCallWithinLimit.mock.calls,
    }).toEqual({
      result: { ok: false, error: 'menuLimit' },
      asked: 0,
      claims: [['u1', expect.any(String), 'menu', MENU_MODEL]],
    });
  });

  it('作り直しの前に上限に達したら、もう呼ばずに menuFailed を返す', async () => {
    limit.claimAiCallWithinLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const result = await createMenuAction({ ok: true }, form({ minutes: '60' }));
    expect({
      result,
      asked: askJson.mock.calls.length,
      saved: data.saveMenu.mock.calls.length,
    }).toEqual({
      result: { ok: false, error: 'menuFailed' },
      asked: 1,
      saved: 0,
    });
  });
});

describe('askMenuAction', () => {
  it('上限に達していれば AI を呼ばずに chatLimit を返す', async () => {
    data.getMenu.mockResolvedValue(savedMenu);
    limit.claimAiCallWithinLimit.mockResolvedValue(false);
    const result = await askMenuAction({ ok: true }, form({ question: '短くして' }));
    expect({
      result,
      asked: askJson.mock.calls.length,
      claims: limit.claimAiCallWithinLimit.mock.calls,
    }).toEqual({
      result: { ok: false, error: 'chatLimit' },
      asked: 0,
      claims: [['u1', expect.any(String), 'chat', CHAT_MODEL]],
    });
  });
});
