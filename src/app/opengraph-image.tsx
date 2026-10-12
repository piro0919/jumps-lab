import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'Jumps Lab — Built for every jump.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** 地の色（写真の左を溶かし込む暗い色）と、「今日を記録」と同じ黄緑（globals.css の --brand） */
const INK = '#0b0d12';
const BRAND = '#d4ff3a';

/**
 * 共有の絵（2026-10-11 の青一色にアイコンと既定の書体の版は、本人に「クソダサい」と言われた。2026-10-12）。
 * LP と同じ走幅跳の写真を右に敷き、左を暗く溶かして、ロゴの書体（Kanit の極太の斜体）で LP の見出しを置く。
 * kkweb.io の一覧では 176px まで縮むので、見出しは2行・大きく。字は英字だけなので和文の書体は持たない。
 * next/og は WebP を読めないので、写真は assets/og に JPEG で置いた（LP と同じ、ChatGPT で生成した架空の選手）。
 * 書体は Kanit（OFL、assets/og/OFL.txt）。ビルドのときに焼く（開くたびに作ると本番で落ちる）
 */
export default async function OpengraphImage() {
  const dir = join(process.cwd(), 'assets/og');
  const [font, photo, icon] = await Promise.all([
    readFile(join(dir, 'Kanit-ExtraBoldItalic.ttf')),
    readFile(join(dir, 'long-jump-flight.jpg')),
    readFile(join(process.cwd(), 'public/icon-512x512.png')),
  ]);
  const photoSrc = `data:image/jpeg;base64,${photo.toString('base64')}`;
  const iconSrc = `data:image/png;base64,${icon.toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: INK,
        color: '#ffffff',
        fontFamily: 'Kanit',
        fontStyle: 'italic',
      }}
    >
      {/* 写真（4:3）は高さに合わせて元の比のまま置き、右へはみ出させて選手を右寄りにする
          （右端に揃えると選手が中央に来て、見出しと重なって窮屈に見えた。本人、2026-10-12） */}
      <img
        src={photoSrc}
        alt=""
        width={840}
        height={630}
        style={{ position: 'absolute', right: -190, top: 0, width: 840, height: 630 }}
      />
      {/* 写真の左を地の色へ溶かす */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1200,
          height: 630,
          display: 'flex',
          backgroundImage: `linear-gradient(90deg, ${INK} 48%, rgba(11,13,18,0.75) 60%, rgba(11,13,18,0) 80%)`,
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <img src={iconSrc} width={64} height={64} alt="" style={{ borderRadius: 16 }} />
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: 1 }}>JUMPS LAB</div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 108,
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: -1,
          }}
        >
          <div>BUILT FOR</div>
          <div style={{ color: BRAND }}>EVERY JUMP.</div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 2, opacity: 0.85 }}>
          HIGH JUMP · LONG JUMP · TRIPLE JUMP · POLE VAULT
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: 'Kanit', data: font, weight: 800, style: 'italic' }],
    },
  );
}
