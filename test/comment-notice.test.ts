import { describe, expect, it } from 'vitest';
import { commentNotice, noticeName } from '@/lib/comment-notice';
import { commentOpen, commentRole } from '@/lib/comments';

/**
 * コメントの知らせの中身（src/lib/comment-notice.ts）と、書ける日・役の決め方（src/lib/comments.ts）。
 * 知らせはロック画面に出るので、選手へはコーチの名前も載せず、コーチへは選手の表示名とチームの名前だけ
 */

const base = {
  athleteId: 'user-1',
  athleteName: 'Hana',
  teamId: '11111111-1111-4111-8111-111111111111',
  teamName: 'Hawks',
  day: '2026-10-14',
};

describe('commentNotice', () => {
  it('コーチが書いたら、選手へは決まった題とチームの名前だけ。押すと自分の日のコメントへ', () => {
    const notices = (['en', 'ja'] as const).map((locale) =>
      commentNotice({ ...base, toCoaches: false }, locale),
    );
    expect(notices).toEqual([
      {
        title: 'New comment from your coach',
        body: 'Team: Hawks',
        url: '/log/2026-10-14#comments',
        tag: `comment-${base.teamId}-user-1-2026-10-14`,
      },
      {
        title: 'コーチからコメントが届きました',
        body: 'チーム：Hawks',
        url: '/log/2026-10-14#comments',
        tag: `comment-${base.teamId}-user-1-2026-10-14`,
      },
    ]);
  });

  it('選手が書いたら、コーチへは選手の表示名とチームの名前。押すと選手の画面のその日へ', () => {
    expect(commentNotice({ ...base, toCoaches: true }, 'ja')).toEqual({
      title: 'Hanaさんからコメントが届きました',
      body: 'チーム：Hawks',
      url: `/teams/${base.teamId}/members/user-1#day-2026-10-14`,
      tag: `comment-${base.teamId}-user-1-2026-10-14`,
    });
  });

  it('名前が空になる（制御文字だけ）なら、名前の無い題にする', () => {
    expect(commentNotice({ ...base, athleteName: '‮\u0000', toCoaches: true }, 'en').title).toBe(
      'New comment from an athlete',
    );
  });
});

describe('noticeName', () => {
  it('制御文字と向きを変える文字を除き、空白を詰め、50文字で切る', () => {
    expect([
      noticeName('  Ha‮na \n Sato '),
      noticeName('a'.repeat(60))?.length,
      noticeName('‏'),
    ]).toEqual(['Hana Sato', 50, null]);
  });
});

describe('commentOpen', () => {
  it('選手の今日を含む直近14日だけ書ける（先の日と15日前は書けない）', () => {
    const today = '2026-10-14';
    expect(
      ['2026-10-15', '2026-10-14', '2026-10-01', '2026-09-30'].map((day) =>
        commentOpen(day, today),
      ),
    ).toEqual([false, true, true, false]);
  });
});

describe('commentRole', () => {
  it('自分が書いたものは you、ほかはコーチか選手', () => {
    expect([
      commentRole({ authorId: 'me', byCoach: true }, 'me'),
      commentRole({ authorId: 'c', byCoach: true }, 'me'),
      commentRole({ authorId: 'a', byCoach: false }, 'me'),
    ]).toEqual(['you', 'coach', 'athlete']);
  });
});
