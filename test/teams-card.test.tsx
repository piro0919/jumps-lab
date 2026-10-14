// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * ホームのチームのカード（src/components/teams-card.tsx）。コーチしていなければ何も出さない。
 * コーチしていれば1チーム1行で、押すとコーチの画面。印のある選手の札は1人以上のときだけ出す
 */

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    values?.count === undefined ? key : `${key}:${values.count}`,
}));

const { TeamsCard } = await import('@/components/teams-card');

afterEach(cleanup);

describe('TeamsCard', () => {
  it('コーチしているチームがなければ何も出さない', () => {
    const { container } = render(createElement(TeamsCard, { teams: [] }));
    expect(container.innerHTML).toBe('');
  });

  it('チームごとに名前・選手の数を出してコーチの画面へつなぎ、印の札は1人以上のときだけ出す', () => {
    render(
      createElement(TeamsCard, {
        teams: [
          { id: 'a', name: 'Hawks', memberCount: 4, flagged: 2 },
          { id: 'b', name: 'Eagles', memberCount: 3, flagged: 0 },
        ],
      }),
    );
    expect(
      screen.getAllByRole('link').map((link) => [link.getAttribute('href'), link.textContent]),
    ).toEqual([
      ['/teams/a', 'HawksmemberCount:4flagged:2'],
      ['/teams/b', 'EaglesmemberCount:3'],
    ]);
  });
});
