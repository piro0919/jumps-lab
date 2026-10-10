import { describe, expect, it } from 'vitest';
import { optionalNumber, optionalText } from '@/lib/form';

describe('optionalNumber', () => {
  const schema = optionalNumber(0, 10);

  it('空や送られていない欄は null', () => {
    expect(schema.parse('')).toBeNull();
    expect(schema.parse('  ')).toBeNull();
    expect(schema.parse(undefined)).toBeNull();
  });

  it('数に直し、範囲の外は弾く', () => {
    expect(schema.parse('1.5')).toBe(1.5);
    expect(schema.safeParse('11').success).toBe(false);
    expect(schema.safeParse('abc').success).toBe(false);
  });
});

describe('optionalText', () => {
  const schema = optionalText(5);

  it('前後の空白を落とし、空は null', () => {
    expect(schema.parse('  hi ')).toBe('hi');
    expect(schema.parse('   ')).toBeNull();
    expect(schema.parse(undefined)).toBeNull();
  });

  it('長すぎる文は弾く', () => {
    expect(schema.safeParse('123456').success).toBe(false);
  });
});
