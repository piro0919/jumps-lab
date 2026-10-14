// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../messages/en.json';
import ja from '../messages/ja.json';
import { EMPTY_DETAILS } from '@/lib/attempt-details';
import type { Attempt } from '@/lib/data';

/**
 * 試技の細かい記録の画面。入力（src/components/attempt-form.tsx）は選んだ種目の欄だけを出し、
 * 日の画面の行（src/components/attempts-card.tsx）は入っている欄を本人の単位で1行に並べる
 */

vi.mock('@/app/actions/today', () => ({
  saveAttemptAction: vi.fn(),
  deleteAttemptAction: vi.fn(),
}));
vi.mock('@bprogress/next/app', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { AttemptForm } = await import('@/components/attempt-form');
const { AttemptsCard } = await import('@/components/attempts-card');

afterEach(cleanup);

function withIntl(locale: 'en' | 'ja', children: ReactNode) {
  return (
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ja} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

const DETAIL_NAMES = [
  'approachSteps',
  'approachLengthM',
  'boardOffsetCm',
  'poleLengthM',
  'poleStiffnessLb',
  'gripHeightM',
  'standardsCm',
];

/** フォームにある細かい記録の欄の名前 */
const detailFields = () =>
  DETAIL_NAMES.filter((name) => document.querySelector(`form [name="${name}"]`) !== null);

describe('AttemptForm の細かい記録', () => {
  it('種目を切り替えると、その種目の欄だけになる', () => {
    render(
      withIntl(
        'en',
        createElement(AttemptForm, {
          day: '2026-10-14',
          events: ['high_jump', 'long_jump', 'pole_vault'],
          initialEvent: 'high_jump',
          units: 'metric',
          backHref: '/log/today',
        }),
      ),
    );
    const shown = { high_jump: detailFields() };
    fireEvent.click(screen.getByRole('button', { name: 'Long jump' }));
    const longJump = detailFields();
    fireEvent.click(screen.getByRole('button', { name: 'Pole vault' }));

    expect({ ...shown, long_jump: longJump, pole_vault: detailFields() }).toEqual({
      high_jump: ['approachSteps', 'approachLengthM'],
      long_jump: ['approachSteps', 'approachLengthM', 'boardOffsetCm'],
      pole_vault: [
        'approachSteps',
        'approachLengthM',
        'poleLengthM',
        'poleStiffnessLb',
        'gripHeightM',
        'standardsCm',
      ],
    });
  });

  it('直すときは入っている値を本人の単位で出し、詳細を開いておく', () => {
    const attempt: Attempt = {
      id: 'a1',
      day: '2026-10-14',
      event: 'pole_vault',
      kind: 'practice',
      markM: 4.2,
      windMs: null,
      note: null,
      details: { ...EMPTY_DETAILS, poleLengthM: 4.572, standardsCm: 45.7 },
    };
    render(
      withIntl(
        'en',
        createElement(AttemptForm, {
          day: '2026-10-14',
          events: ['pole_vault'],
          initialEvent: 'pole_vault',
          units: 'imperial',
          backHref: '/log/today',
          initial: attempt,
        }),
      ),
    );
    // 欄の名前の付いた label の中の、はじめの見える欄（フィート・インチならフィート）
    const visible = (label: string) =>
      (
        screen
          .getByText(label)
          .closest('label')
          ?.querySelector('input:not([type="hidden"])') as HTMLInputElement
      ).value;
    const hidden = (name: string) =>
      (document.querySelector(`input[type="hidden"][name="${name}"]`) as HTMLInputElement).value;

    expect({
      open: (document.querySelector('details') as HTMLDetailsElement).open,
      poleFeet: visible('Pole length'),
      standardsInches: visible('Standards'),
      poleSent: hidden('poleLengthM'),
      standardsSent: hidden('standardsCm'),
    }).toEqual({
      open: true,
      poleFeet: '15',
      standardsInches: '18',
      poleSent: '4.572',
      standardsSent: '45.7',
    });
  });
});

describe('AttemptsCard の細かい記録の行', () => {
  const attempts: Attempt[] = [
    {
      id: 'lj',
      day: '2026-10-14',
      event: 'long_jump',
      kind: 'practice',
      markM: 6.5,
      windMs: null,
      note: null,
      details: { ...EMPTY_DETAILS, approachSteps: 18, approachLengthM: 40.5, boardOffsetCm: 12 },
    },
    {
      id: 'lj-foul',
      day: '2026-10-14',
      event: 'long_jump',
      kind: 'practice',
      markM: 6.2,
      windMs: null,
      note: null,
      details: { ...EMPTY_DETAILS, boardOffsetCm: -3 },
    },
    {
      id: 'pv',
      day: '2026-10-14',
      event: 'pole_vault',
      kind: 'practice',
      markM: 4.2,
      windMs: null,
      note: null,
      details: {
        ...EMPTY_DETAILS,
        poleLengthM: 4.572,
        poleStiffnessLb: 160,
        gripHeightM: 4.3942,
        standardsCm: 45.7,
      },
    },
    {
      id: 'plain',
      day: '2026-10-14',
      event: 'high_jump',
      kind: 'practice',
      markM: 1.8,
      windMs: null,
      note: null,
      details: EMPTY_DETAILS,
    },
  ];

  const lines = (locale: 'en' | 'ja', units: 'metric' | 'imperial') => {
    render(
      withIntl(
        locale,
        createElement(AttemptsCard, {
          day: '2026-10-14',
          events: ['long_jump', 'pole_vault', 'high_jump'],
          units,
          attempts,
          readOnly: true,
        }),
      ),
    );
    const texts = [...document.querySelectorAll('li')].map((li) => li.textContent ?? '');
    cleanup();
    return texts;
  };

  it('入っている欄だけを、本人の単位で1行に並べる（見るだけの画面でも）', () => {
    expect({ metric: lines('en', 'metric'), imperial: lines('en', 'imperial') }).toEqual({
      metric: [
        expect.stringContaining('18 steps, 40.50 m approach, 12 cm behind the board'),
        expect.stringContaining('3 cm over the board'),
        expect.stringContaining('4.57 m pole, 160 lb, Grip 4.39 m, Standards 46 cm'),
        expect.not.stringContaining(','),
      ],
      imperial: [
        expect.stringContaining(`18 steps, 132' 10¼" approach, 4¾" behind the board`),
        expect.stringContaining('1¼" over the board'),
        expect.stringContaining(`15' 0" pole, 160 lb, Grip 14' 5", Standards 18"`),
        expect.not.stringContaining(','),
      ],
    });
  });

  it('日本語でも文の形で並べる', () => {
    expect(lines('ja', 'metric').slice(0, 2)).toEqual([
      expect.stringContaining('18歩 助走40.50 m 踏切板の12 cm手前'),
      expect.stringContaining('踏切板を3 cm越え'),
    ]);
  });
});
