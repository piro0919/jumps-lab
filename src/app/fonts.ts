import { Barlow_Condensed, Kanit } from 'next/font/google';

// 記録の数字と英字の見出しの字（手本の Nike Run Club の、細長く太い斜体の数字）。
// 英数字だけの書体なので、日本語の文は端末の字のまま
const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['700', '800'],
  style: ['italic'],
  variable: '--font-barlow',
});

// ロゴの字（Kanit の極太の斜体）。数字の書体と分けて、ロゴを看板として立たせる（本人が選んだ、2026-10-11）
const logo = Kanit({
  subsets: ['latin'],
  weight: '800',
  style: 'italic',
  variable: '--font-kanit',
});

/** html に付ける書体の変数。外枠（layout.tsx）と、外枠の代わりに描く global-error.tsx の両方で使う */
export const FONT_VARIABLES = `${display.variable} ${logo.variable}`;
