import { describe, expect, it } from 'vitest';
import {
  FATIGUE_FLAG,
  hashInviteToken,
  inviteLinkState,
  newInviteToken,
  rosterFlags,
  sortRoster,
} from '@/lib/teams';

/**
 * チームの決まり（src/lib/teams.ts）: 招待のリンクの鍵、リンクが使えるか、コーチの一覧の印と並び
 */

describe('招待のリンクの鍵', () => {
  it('URL にそのまま入る形で、毎回違う', () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('DB に持つハッシュは鍵と違い、同じ鍵からは同じハッシュ', () => {
    const token = newInviteToken();
    expect(hashInviteToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(token)).not.toContain(token);
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
  });
});

describe('inviteLinkState', () => {
  const now = new Date('2026-10-14T00:00:00Z');
  it('切られていなければ期限の内だけ使える', () => {
    expect(
      inviteLinkState({ revokedAt: null, expiresAt: new Date('2026-10-15T00:00:00Z') }, now),
    ).toBe('valid');
    expect(inviteLinkState({ revokedAt: null, expiresAt: now }, now)).toBe('expired');
  });

  it('切ったリンクは期限の内でも使えない', () => {
    expect(
      inviteLinkState({ revokedAt: now, expiresAt: new Date('2026-10-20T00:00:00Z') }, now),
    ).toBe('revoked');
  });
});

describe('rosterFlags', () => {
  const today = '2026-10-14';
  const none = { lastPainDay: null, latestFatigue: null };

  it('記録が無ければ印は無い', () => {
    expect(rosterFlags(none, today)).toEqual([]);
  });

  it('痛みのメモは今日を含む直近7日だけ', () => {
    expect(rosterFlags({ ...none, lastPainDay: '2026-10-08' }, today)).toEqual(['pain']);
    expect(rosterFlags({ ...none, lastPainDay: '2026-10-07' }, today)).toEqual([]);
  });

  it('疲労は線（今日のアドバイスと同じ）以上で、直近7日の記録だけ', () => {
    expect(FATIGUE_FLAG).toBe(8);
    const fatigue = (day: string, value: number) => ({ ...none, latestFatigue: { day, value } });
    expect(rosterFlags(fatigue(today, FATIGUE_FLAG), today)).toEqual(['fatigue']);
    expect(rosterFlags(fatigue(today, FATIGUE_FLAG - 1), today)).toEqual([]);
    expect(rosterFlags(fatigue('2026-10-07', 10), today)).toEqual([]);
  });

  it('両方あれば両方', () => {
    expect(
      rosterFlags({ lastPainDay: today, latestFatigue: { day: today, value: 9 } }, today),
    ).toEqual(['pain', 'fatigue']);
  });
});

describe('sortRoster', () => {
  it('印の多い選手を先に、同じなら名前の順', () => {
    const rows = [
      { name: 'Chika', flags: [] },
      { name: 'Aoi', flags: [] },
      { name: 'Ben', flags: ['pain' as const] },
      { name: 'Dai', flags: ['pain' as const, 'fatigue' as const] },
    ];
    expect(sortRoster(rows, 'en').map((r) => r.name)).toEqual(['Dai', 'Ben', 'Aoi', 'Chika']);
  });
});
