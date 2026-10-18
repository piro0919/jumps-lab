// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import { MarkInput, type MetricStyle } from '@/components/measure-inputs';

/**
 * 記録の欄の metric の入れ方（2026-10-18）。走高跳・棒高跳は cm の1つの欄、走幅跳・三段跳は m と cm の2つの欄。
 * 送るのはどれもメートル。触っていなければ持っている値をそのまま送る（表示の切り捨てを送り返さない）
 */

afterEach(cleanup);

function renderInput(metricStyle: MetricStyle, defaultMeters: number | null = null) {
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <form>
        <MarkInput
          name="markM"
          units="metric"
          metricStyle={metricStyle}
          defaultMeters={defaultMeters}
          range={{ min: 1, max: 20, message: 'Out of range' }}
        />
      </form>
    </NextIntlClientProvider>,
  );
  const fields = [...container.querySelectorAll('input[type=number]')] as HTMLInputElement[];
  const sent = () => new FormData(container.querySelector('form')!).get('markM');
  return { fields, sent };
}

describe('MarkInput の metric の入れ方', () => {
  it('cm は整数のセンチを、mcm は m と cm を合わせてメートルで送る', () => {
    const cm = renderInput('cm');
    fireEvent.change(cm.fields[0]!, { target: { value: '205' } });
    const cmSent = cm.sent();
    cleanup();
    const mcm = renderInput('mcm');
    fireEvent.change(mcm.fields[0]!, { target: { value: '6' } });
    fireEvent.change(mcm.fields[1]!, { target: { value: '91' } });

    expect({ cmSent, mcmSent: mcm.sent(), cmFields: cm.fields.length }).toEqual({
      cmSent: '2.05',
      mcmSent: '6.91',
      cmFields: 1,
    });
  });

  it('持っている値はセンチで切り捨てて出し、触っていなければそのまま送る', () => {
    const cm = renderInput('cm', 2.0567);
    const cmShown = cm.fields.map((f) => f.value);
    const cmSent = cm.sent();
    cleanup();
    const mcm = renderInput('mcm', 6.9159);
    expect({
      cmShown,
      cmSent,
      mcmShown: mcm.fields.map((f) => f.value),
      mcmSent: mcm.sent(),
    }).toEqual({ cmShown: ['205'], cmSent: '2.0567', mcmShown: ['6', '91'], mcmSent: '6.9159' });
  });

  it('mcm は合わせた長さが範囲の外なら m の欄で止める', () => {
    const mcm = renderInput('mcm');
    fireEvent.change(mcm.fields[0]!, { target: { value: '0' } });
    fireEvent.change(mcm.fields[1]!, { target: { value: '50' } });
    const outside = mcm.fields[0]!.validationMessage;
    fireEvent.change(mcm.fields[0]!, { target: { value: '5' } });
    expect({ outside, inside: mcm.fields[0]!.validationMessage }).toEqual({
      outside: 'Out of range',
      inside: '',
    });
  });
});
