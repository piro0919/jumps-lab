// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../messages/en.json';
import ja from '../messages/ja.json';
import { EMPTY_DETAILS } from '@/lib/attempt-details';
import type { Attempt } from '@/lib/data';
import type { HeightSeries } from '@/lib/height-series';

/**
 * 走高跳・棒高跳の高さごとの結果の画面。入力（src/components/height-series-fields.tsx を置いた attempt-form.tsx）と、
 * 日の画面の行（src/components/attempts-card.tsx）
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

const renderForm = (
  units: 'metric' | 'imperial',
  events: Attempt['event'][] = ['high_jump'],
  initial?: Attempt,
) =>
  render(
    withIntl(
      'en',
      createElement(AttemptForm, {
        day: '2026-10-14',
        events,
        initialEvent: events[0]!,
        units,
        backHref: '/log/today',
        initial,
      }),
    ),
  );

const form = () => document.querySelector('form') as HTMLFormElement;
/** 送る高さごとの結果（JSON を読んだもの。空なら null） */
const sentSeries = () => {
  const value = new FormData(form()).get('heightSeries');
  return typeof value === 'string' && value !== '' ? JSON.parse(value) : null;
};
const slot = (height: string, n: number) =>
  screen.getByRole('button', { name: new RegExp(`^${height}, trial ${n}:`) });
const press = (height: string, n: number, times = 1) => {
  for (let i = 0; i < times; i += 1) fireEvent.click(slot(height, n));
};
const addHeight = () => fireEvent.click(screen.getByRole('button', { name: 'Add height' }));
/** 記録の欄が見えているか（高さごとに入れているあいだは隠す） */
const markFieldShown = () => !(screen.getByText('Mark').closest('[hidden]') instanceof HTMLElement);

describe('AttemptForm の高さごとの結果', () => {
  it('高さを足して O・X を押すと、記録はいちばん高く越えた高さになる', () => {
    renderForm('metric');
    const before = { markField: markFieldShown(), series: sentSeries() };
    addHeight();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Bar height 1' }), {
      target: { value: '1.80' },
    });
    press('1.80 m', 1);
    // 次の高さは前の高さに 3cm 足した高さで入る
    addHeight();
    const next = (screen.getByRole('spinbutton', { name: 'Bar height 2' }) as HTMLInputElement)
      .value;
    press('1.83 m', 1, 2);
    press('1.83 m', 2);
    addHeight();
    press('1.86 m', 1, 2);
    press('1.86 m', 2, 2);
    press('1.86 m', 3, 2);

    expect({
      before,
      next,
      markField: markFieldShown(),
      mark: screen.getByText('Mark (best height cleared)').parentElement?.textContent,
      series: sentSeries(),
      // 続けて3回失敗したら、その先の高さは足せない
      addDisabled: (screen.getByRole('button', { name: 'Add height' }) as HTMLButtonElement)
        .disabled,
    }).toEqual({
      before: { markField: true, series: null },
      next: '1.83',
      markField: false,
      mark: 'Mark (best height cleared)1.83 m',
      series: [
        { heightM: 1.8, trials: ['cleared'] },
        { heightM: 1.83, trials: ['missed', 'cleared'] },
        { heightM: 1.86, trials: ['missed', 'missed', 'missed'] },
      ],
      addDisabled: true,
    });
  });

  it('押すたびに 空 → O → X → – → 空。成功やパスのあとの欄は押せず、失敗から変えると後ろは消える', () => {
    renderForm('metric');
    addHeight();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Bar height 1' }), {
      target: { value: '2.00' },
    });
    const symbols = () => [1, 2, 3].map((n) => slot('2.00 m', n).textContent);
    const disabled = () => [1, 2, 3].map((n) => (slot('2.00 m', n) as HTMLButtonElement).disabled);
    const steps: { symbols: (string | null)[]; disabled: boolean[] }[] = [];
    const record = () => steps.push({ symbols: symbols(), disabled: disabled() });
    press('2.00 m', 1);
    record();
    press('2.00 m', 1);
    press('2.00 m', 2, 2);
    record();
    press('2.00 m', 1);
    record();
    press('2.00 m', 1);
    record();

    expect(steps).toEqual([
      { symbols: ['O', '', ''], disabled: [false, true, true] },
      { symbols: ['X', 'X', ''], disabled: [false, false, false] },
      { symbols: ['–', '', ''], disabled: [false, true, true] },
      { symbols: ['', '', ''], disabled: [false, true, true] },
    ]);
  });

  it('越えた高さが無いあいだは記録を出さず、規則に合わない並びはその場で言う', () => {
    renderForm('metric');
    addHeight();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Bar height 1' }), {
      target: { value: '1.50' },
    });
    press('1.50 m', 1, 2);
    const noClear = screen.queryByText('No height cleared yet') !== null;
    addHeight();
    press('1.53 m', 1);

    expect({
      noClear,
      error: screen.queryByText('At 1.50 m, clear it or pass before going to the next height.')
        ?.textContent,
    }).toEqual({
      noClear: true,
      error: 'At 1.50 m, clear it or pass before going to the next height.',
    });
  });

  it('走幅跳と三段跳には出さない。種目を戻せば入れた高さが残っている', () => {
    renderForm('metric', ['high_jump', 'long_jump']);
    addHeight();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Bar height 1' }), {
      target: { value: '1.70' },
    });
    press('1.70 m', 1);
    fireEvent.click(screen.getByRole('button', { name: 'Long jump' }));
    const longJump = {
      section: screen.queryByText('By height'),
      series: new FormData(form()).get('heightSeries'),
      markField: markFieldShown(),
    };
    fireEvent.click(screen.getByRole('button', { name: 'High jump' }));

    expect({ longJump, back: sentSeries() }).toEqual({
      longJump: { section: null, series: null, markField: true },
      back: [{ heightM: 1.7, trials: ['cleared'] }],
    });
  });

  it('高さを消すと行がなくなり、すべて消すと記録の欄に戻る', () => {
    renderForm('metric');
    addHeight();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Bar height 1' }), {
      target: { value: '1.70' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove 1.70 m' }));
    expect({ markField: markFieldShown(), series: sentSeries() }).toEqual({
      markField: true,
      series: null,
    });
  });
});

describe('AttemptForm の高さを直さずに保存する', () => {
  /** 6' 0¾"（1.8478）と 6' 1¾"（1.8732）。フィート・インチで入れた高さは、メートルに直すと丸まる */
  const series: HeightSeries = [
    { heightM: 1.8478, trials: ['cleared'] },
    { heightM: 1.8732, trials: ['missed', 'passed'] },
    { heightM: 1.9, trials: ['missed', 'missed'] },
  ];
  const highJump: Attempt = {
    id: 'hj',
    day: '2026-10-14',
    event: 'high_jump',
    kind: 'competition',
    markM: 1.8478,
    windMs: null,
    note: null,
    heightSeries: series,
    details: EMPTY_DETAILS,
  };

  it('どちらの単位でも、触っていない高さはそのまま送り、書き換えた高さだけ変わる', () => {
    renderForm('metric', ['high_jump'], highJump);
    const metric = sentSeries();
    const shown = (screen.getByRole('spinbutton', { name: 'Bar height 1' }) as HTMLInputElement)
      .value;
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Bar height 3' }), {
      target: { value: '1.91' },
    });
    const edited = sentSeries().map((row: { heightM: number }) => row.heightM);
    cleanup();
    renderForm('imperial', ['high_jump'], highJump);
    const imperial = sentSeries();

    expect({ metric, shown, edited, imperial }).toEqual({
      metric: series,
      shown: '1.85',
      edited: [1.8478, 1.8732, 1.91],
      imperial: series,
    });
  });

  it('フィート・インチで足した高さは 1 インチ上の、4分の1インチの刻みの高さ', () => {
    renderForm('imperial', ['high_jump'], { ...highJump, heightSeries: series.slice(0, 2) });
    addHeight();
    const [feet, inches] = [
      screen.getByRole('spinbutton', { name: 'Bar height 3, feet' }),
      screen.getByRole('spinbutton', { name: 'Bar height 3, inches' }),
    ].map((el) => (el as HTMLInputElement).value);
    expect({ feet, inches, sent: sentSeries().at(-1).heightM }).toEqual({
      feet: '6',
      inches: '2.75',
      sent: 1.8987,
    });
  });
});

describe('AttemptsCard の高さごとの結果', () => {
  const attempt: Attempt = {
    id: 'hj',
    day: '2026-10-14',
    event: 'high_jump',
    kind: 'competition',
    markM: 1.85,
    windMs: null,
    note: null,
    heightSeries: [
      { heightM: 1.8, trials: ['cleared'] },
      { heightM: 1.85, trials: ['missed', 'cleared'] },
      { heightM: 1.9, trials: ['missed', 'passed'] },
      { heightM: 1.95, trials: ['missed', 'missed'] },
    ],
    details: EMPTY_DETAILS,
  };

  const shown = (locale: 'en' | 'ja', units: 'metric' | 'imperial') => {
    render(
      withIntl(
        locale,
        createElement(AttemptsCard, {
          day: '2026-10-14',
          events: ['high_jump'],
          units,
          attempts: [attempt],
          readOnly: true,
        }),
      ),
    );
    const items = [...document.querySelectorAll('li li')];
    const result = {
      text: items.map((li) => li.textContent),
      labels: items.map((li) => li.getAttribute('aria-label')),
      misses: screen.getByText(/Misses|失敗/).textContent,
    };
    cleanup();
    return result;
  };

  it('高さごとに O・X・– を並べ、読み上げは語で、同じ高さで並んだときの失敗の数を添える', () => {
    expect({ en: shown('en', 'metric'), ja: shown('ja', 'imperial') }).toEqual({
      en: {
        text: ['1.80 m O', '1.85 m XO', '1.90 m X–', '1.95 m XX'],
        labels: [
          '1.80 m: cleared',
          '1.85 m: missed, cleared',
          '1.90 m: missed, passed',
          '1.95 m: missed, missed',
        ],
        misses: 'Misses: 1 in total, 1 at the best height',
      },
      ja: {
        text: [`5' 10¾" O`, `6' 0¾" XO`, `6' 2¾" X–`, `6' 4¾" XX`],
        labels: [`5' 10¾"：成功`, `6' 0¾"：失敗 成功`, `6' 2¾"：失敗 パス`, `6' 4¾"：失敗 失敗`],
        misses: '失敗 合計1回・最高の高さで1回',
      },
    });
  });
});
