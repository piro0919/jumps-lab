// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * その日の動画のカード（src/components/videos-card.tsx）。readOnly（コーチが選手の動画を見る画面）では、
 * 足す・見比べ・保存・削除を出さない。本人の画面では出す
 */

vi.mock('@/app/actions/videos', () => ({ deleteVideoAction: vi.fn() }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => 'Jan 1, 2027' }),
}));

const { VideosCard } = await import('@/components/videos-card');

afterEach(cleanup);

const video = {
  id: 'v1',
  event: 'long_jump' as const,
  kind: 'practice' as const,
  note: null,
  url: 'https://example.com/v1.mp4',
  expiresAt: '2027-01-01T00:00:00Z',
  attemptLabel: null,
};

const controls = () =>
  ['add', 'compare', 'download', 'delete'].filter(
    (name) =>
      screen.queryByRole('link', { name }) !== null ||
      screen.queryByRole('button', { name }) !== null,
  );

describe('VideosCard', () => {
  it('readOnly では、足す・見比べ・保存・削除を出さない', () => {
    render(createElement(VideosCard, { videos: [video], timeZone: 'UTC', readOnly: true }));
    expect(controls()).toEqual([]);
  });

  it('本人の画面では、足す・見比べ・保存・削除を出す', () => {
    render(
      createElement(VideosCard, {
        videos: [{ ...video, downloadUrl: 'https://example.com/v1-save.mp4' }],
        timeZone: 'UTC',
        addHref: '/log/2026-10-14/videos/new',
      }),
    );
    expect(controls()).toEqual(['add', 'compare', 'download', 'delete']);
  });
});
