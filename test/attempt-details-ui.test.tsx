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

const renderForm = (
  units: 'metric' | 'imperial',
  event: Attempt['event'] = 'pole_vault',
  initial?: Attempt,
) =>
  render(
    withIntl(
      'en',
      createElement(AttemptForm, {
        day: '2026-10-14',
        events: [event],
        initialEvent: event,
        units,
        backHref: '/log/today',
        initial,
      }),
    ),
  );
const form = () => document.querySelector('form') as HTMLFormElement;
const sent = (names: string[]) => {
  const data = new FormData(form());
  return Object.fromEntries(names.map((name) => [name, data.get(name)]));
};
/**
 * ブラウザが送るのを止める欄か（範囲の外、自前の検査、刻みに合わない値）。happy-dom の刻みの確かめは
 * 小数の誤差で 0.01 刻みの 4.20 も外れにするので、刻みはブラウザと同じく min からの数でここで確かめる
 */
const blocked = (el: HTMLInputElement) => {
  const { rangeOverflow, rangeUnderflow, customError } = el.validity;
  if (rangeOverflow || rangeUnderflow || customError) return true;
  if (el.value === '' || el.step === 'any') return false;
  const steps = (Number(el.value) - Number(el.min || 0)) / Number(el.step || 1);
  return Math.abs(steps - Math.round(steps)) > STEP_SLACK;
};
const STEP_SLACK = 1e-6;
/** フォームの見える数の欄のうち、ブラウザが止めるもの（name か、無ければ欄の名前） */
const blockedFields = () =>
  [...form().querySelectorAll<HTMLInputElement>('input[type="number"]')]
    .filter(blocked)
    .map((el) => el.closest('label')?.textContent ?? el.name);
/** 欄の名前の付いた label の中の、見える欄（フィート・インチなら [フィート, インチ]） */
const inputs = (label: string) => [
  ...(screen
    .getByText(label)
    .closest('label')
    ?.querySelectorAll<HTMLInputElement>('input:not([type="hidden"])') ?? []),
];
/** 欄の名前の付いた label の中の、はじめの見える欄（フィート・インチならフィート） */
const input = (label: string) => inputs(label)[0] as HTMLInputElement;

describe('AttemptForm の長さの欄を直さずに保存する', () => {
  /** 0.1mm・0.1cm で持っている値。表示の単位に直すと丸まるもの（フィート・インチで入れた値と、cm で入れた値） */
  const vault: Attempt = {
    id: 'pv',
    day: '2026-10-14',
    event: 'pole_vault',
    kind: 'practice',
    markM: 4.2032,
    windMs: null,
    note: null,
    details: {
      ...EMPTY_DETAILS,
      approachSteps: 16,
      approachLengthM: 38.4048,
      poleLengthM: 4.572,
      poleStiffnessLb: 160,
      gripHeightM: 4.3942,
      standardsCm: 12,
    },
  };
  const jump: Attempt = {
    ...vault,
    id: 'lj',
    event: 'long_jump',
    markM: 6.5532,
    details: { ...EMPTY_DETAILS, approachLengthM: 40.123, boardOffsetCm: -3.3 },
  };
  /** 送るはずの値（持っている値そのまま） */
  const stored = (attempt: Attempt) =>
    Object.fromEntries([
      ['markM', String(attempt.markM)],
      ...Object.entries(attempt.details)
        .filter(([, value]) => value !== null)
        .map(([key, value]) => [key, String(value)]),
    ]);

  it('どちらの単位でも、持っている値をそのまま送り、ブラウザも止めない', () => {
    const cases = (['metric', 'imperial'] as const).flatMap((units) =>
      [vault, jump].map((attempt) => ({ units, attempt })),
    );
    const results = cases.map(({ units, attempt }) => {
      renderForm(units, attempt.event, attempt);
      const result = {
        units,
        event: attempt.event,
        sent: sent(Object.keys(stored(attempt))),
        blocked: blockedFields(),
      };
      cleanup();
      return result;
    });
    expect(results).toEqual(
      cases.map(({ units, attempt }) => ({
        units,
        event: attempt.event,
        sent: stored(attempt),
        blocked: [],
      })),
    );
  });

  it('書き換えた欄だけ、表示の単位から直して送る', () => {
    renderForm('imperial', 'pole_vault', vault);
    fireEvent.change(input('Pole length'), { target: { value: '16' } });
    const imperial = sent(['poleLengthM', 'gripHeightM']);
    cleanup();
    renderForm('metric', 'pole_vault', vault);
    fireEvent.change(input('Standards'), { target: { value: '50' } });
    fireEvent.change(input('Grip height'), { target: { value: '4.40' } });
    const metric = sent(['standardsCm', 'gripHeightM', 'poleLengthM']);

    expect({ imperial, metric }).toEqual({
      imperial: { poleLengthM: '4.8768', gripHeightM: '4.3942' },
      metric: { standardsCm: '50', gripHeightM: '4.40', poleLengthM: '4.572' },
    });
  });
});

describe('AttemptForm の細かい記録の範囲', () => {
  it('範囲の外の長さは、その欄でブラウザが止める', () => {
    renderForm('metric');
    fireEvent.change(input('Pole length'), { target: { value: '7' } });
    fireEvent.change(input('Grip height'), { target: { value: '0.5' } });
    fireEvent.change(input('Approach length'), { target: { value: '61' } });
    const metric = ['Pole length', 'Grip height', 'Approach length', 'Standards'].map((label) =>
      blocked(input(label)),
    );
    cleanup();
    renderForm('imperial');
    fireEvent.change(input('Approach length'), { target: { value: '200' } });
    const feet = input('Approach length');

    expect({ metric, imperial: [blocked(feet), feet.validationMessage] }).toEqual({
      metric: [true, true, true, false],
      imperial: [true, expect.stringContaining('Approach length')],
    });
  });

  it('閉じた詳細の中の欄が止められたら、詳細を開く', () => {
    renderForm('metric');
    const details = document.querySelector('details') as HTMLDetailsElement;
    const closed = details.open;
    fireEvent.change(input('Approach steps'), { target: { value: '31' } });
    const valid = form().checkValidity();

    expect({ closed, valid, open: details.open }).toEqual({
      closed: false,
      valid: false,
      open: true,
    });
  });
});
