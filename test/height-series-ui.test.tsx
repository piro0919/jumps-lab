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

const { saveAttemptAction } = await import('@/app/actions/today');
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
const addButton = () => screen.getByRole('button', { name: 'Add height' }) as HTMLButtonElement;
const addHeight = () => fireEvent.click(addButton());
const symbolsOf = (height: string) => [1, 2, 3].map((n) => slot(height, n).textContent);
const slotsDisabled = (height: string) =>
  [1, 2, 3].map((n) => (slot(height, n) as HTMLButtonElement).disabled);
const setHeight = (n: number, value: string) =>
  fireEvent.change(screen.getByRole('spinbutton', { name: `Bar height ${n}` }), {
    target: { value },
  });
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

  it('越えた高さが無いあいだは記録を出さず、高さはサーバーと同じ 0.1mm に丸めてからその場で確かめる', () => {
    renderForm('metric');
    addHeight();
    setHeight(1, '1.80');
    press('1.80 m', 1, 2);
    const noClear = screen.queryByText('No height cleared yet') !== null;
    press('1.80 m', 1, 3);
    addHeight();
    // 1.80004 m はサーバーで 1.8 m になり、前の高さと同じになる
    setHeight(2, '1.80004');
    fireEvent.click(screen.getAllByRole('button', { name: /^1\.80 m, trial 1:/ })[1]!);

    expect({
      noClear,
      error: screen.queryByText('Each height must be above the one before (1.80 m).')?.textContent,
      sent: sentSeries().map((row: { heightM: number }) => row.heightM),
    }).toEqual({
      noClear: true,
      error: 'Each height must be above the one before (1.80 m).',
      sent: [1.8, 1.8],
    });
  });

  it('欄には規則どおりになる値しか入らず、失敗のままの高さと続けて3回失敗したあとには高さを足せない', () => {
    renderForm('metric');
    addHeight();
    setHeight(1, '1.80');
    press('1.80 m', 1, 2);
    press('1.80 m', 2, 2);
    const afterTwoMisses = addButton().disabled;
    press('1.80 m', 3, 3);
    const passed = { symbols: symbolsOf('1.80 m'), add: addButton().disabled };
    addHeight();
    press('1.83 m', 1, 2);
    const eliminated = {
      slots: slotsDisabled('1.83 m'),
      add: addButton().disabled,
      kind: slot('1.83 m', 1).getAttribute('data-slot'),
    };
    // 次の高さがあるので、1.80 m の3回目は失敗のままにも空にもできず、– の次は O
    press('1.80 m', 3);
    const third = symbolsOf('1.80 m');

    expect({ afterTwoMisses, passed, eliminated, third }).toEqual({
      afterTwoMisses: true,
      passed: { symbols: ['X', 'X', '–'], add: false },
      eliminated: { slots: [false, true, true], add: true, kind: 'button' },
      third: ['X', 'X', 'O'],
    });
  });

  it('サーバーが弾いた理由は、サーバーが返した位置の高さで言い、高さを触ったら消す', async () => {
    vi.mocked(saveAttemptAction).mockResolvedValueOnce({
      ok: false,
      error: 'series.heightOrder',
      row: 1,
    });
    renderForm('metric');
    addHeight();
    setHeight(1, '1.80');
    press('1.80 m', 1);
    addHeight();
    press('1.83 m', 1);
    fireEvent.submit(form());
    const message = 'Each height must be above the one before (1.83 m).';
    const shown = (await screen.findByText(message)).textContent;
    setHeight(2, '1.84');

    expect({ shown, after: screen.queryByText(/Each height must be above/) }).toEqual({
      shown: message,
      after: null,
    });
  });

  it('高さを入れているあいだは、隠した記録の欄を止めて送らない。すべて消すと入れていた記録が戻る', () => {
    renderForm('metric');
    const mark = document.querySelector('input[type=number]') as HTMLInputElement;
    fireEvent.change(mark, { target: { value: '1.805' } });
    addHeight();
    setHeight(1, '1.70');
    // 止めた欄はブラウザの検査にも入らない（happy-dom は step の検査が実物と違うので、止めたことを見る）
    const bySeries = { sent: new FormData(form()).has('markM'), disabled: mark.disabled };
    fireEvent.click(screen.getByRole('button', { name: 'Remove 1.70 m' }));

    expect({ bySeries, back: new FormData(form()).get('markM') }).toEqual({
      bySeries: { sent: false, disabled: true },
      back: '1.805',
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
      // 一覧（ol）は span の中に置かない
      listInSpan: document.querySelector('span ol') !== null,
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
        listInSpan: false,
      },
      ja: {
        text: [`5' 10¾" O`, `6' 0¾" XO`, `6' 2¾" X–`, `6' 4¾" XX`],
        labels: [`5' 10¾"：成功`, `6' 0¾"：失敗 成功`, `6' 2¾"：失敗 パス`, `6' 4¾"：失敗 失敗`],
        misses: '失敗 合計1回・最高の高さで1回',
        listInSpan: false,
      },
    });
  });
});
