import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

/** 地の色（写真の左を溶かし込む暗い色）と、「今日を記録」と同じ黄緑（globals.css の --brand） */
const INK = '#0b0d12';
const BRAND = '#d4ff3a';

/** 見出し。LP の英語の見出し（messages の landing.title）。日本語の絵も英字の大見出しのまま */
const HEADLINE = ['BUILT FOR', 'EVERY JUMP.'];

/**
 * 日本語の絵だけに添える一文（日本語の LP の見出しと同じ文）。小さく、ふつうの太さで、字間を空けて静かに置く。
 * 和文を極太で大きく置いた版は2回とも「ださい」と言われた（2026-10-12）。日本のスポーツブランドは、
 * 大見出しを英字にして日本語を小さく添える（Nike の日本のランニングのページ、アシックスの「ASICS RUNNING」）
 */
const JA_LINE = '跳躍の、一本一本のために。';

const EVENTS = 'HIGH JUMP · LONG JUMP · TRIPLE JUMP · POLE VAULT';

/**
 * 共有の絵（英語は src/app/opengraph-image.tsx、日本語は src/app/(landing)/ja/opengraph-image.tsx）。
 * 2026-10-11 の青一色にアイコンと既定の書体の版は、本人に「クソダサい」と言われた（2026-10-12）。
 * LP と同じ走幅跳の写真を右に敷き、左を暗く溶かして、LP の見出しを置く。ロゴと英字は Kanit の極太の斜体、
 * 日本語の一文は Noto Sans JP の中くらいの太さ（和文は斜体にしない）。
 * kkweb.io の一覧では 176px まで縮むので、見出しは大きく。
 * next/og は WebP も可変フォントも読めないので、写真は JPEG、Noto Sans JP は太さ 500 に固定したものを
 * assets/og に置いた（写真は ChatGPT で生成した架空の選手。書体はどちらも OFL、assets/og/OFL-*.txt）。
 * 和文の書体は字を絞らずに全部持つ（見出しを直しても字が抜けないように。ビルドのときにだけ読むので重さは効かない）。
 * ビルドのときに焼く（開くたびに作ると本番で落ちる）
 */
export async function shareImage(locale: 'en' | 'ja') {
  const dir = join(process.cwd(), 'assets/og');
  const [kanit, noto, photo, icon] = await Promise.all([
    readFile(join(dir, 'Kanit-ExtraBoldItalic.ttf')),
    locale === 'ja' ? readFile(join(dir, 'NotoSansJP-Medium.ttf')) : null,
    readFile(join(dir, 'long-jump-flight.jpg')),
    readFile(join(process.cwd(), 'public/icon-512x512.png')),
  ]);
  const photoSrc = `data:image/jpeg;base64,${photo.toString('base64')}`;
  const iconSrc = `data:image/png;base64,${icon.toString('base64')}`;
  const latin = { fontFamily: 'Kanit', fontStyle: 'italic' as const, fontWeight: 800 };

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: INK,
        color: '#ffffff',
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
      {/* 写真の左を地の色へ溶かす。写真の左端（x=550）より先まで暗くして、端の線を見せない */}
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
          <div style={{ ...latin, fontSize: 44, letterSpacing: 1 }}>JUMPS LAB</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div
            style={{
              ...latin,
              display: 'flex',
              flexDirection: 'column',
              fontSize: 108,
              lineHeight: 0.95,
              letterSpacing: -1,
            }}
          >
            {HEADLINE.map((line, i) => (
              <div key={line} style={{ color: i === 0 ? '#ffffff' : BRAND }}>
                {line}
              </div>
            ))}
          </div>
          {locale === 'ja' && (
            <div
              style={{
                fontFamily: 'Noto Sans JP',
                fontWeight: 500,
                fontSize: 30,
                letterSpacing: 6,
                opacity: 0.92,
              }}
            >
              {JA_LINE}
            </div>
          )}
        </div>
        <div style={{ ...latin, fontSize: 26, letterSpacing: 2, opacity: 0.85 }}>{EVENTS}</div>
      </div>
    </div>,
    {
      ...SHARE_IMAGE_SIZE,
      fonts: [
        { name: 'Kanit', data: kanit, weight: 800, style: 'italic' },
        ...(noto
          ? [{ name: 'Noto Sans JP', data: noto, weight: 500 as const, style: 'normal' as const }]
          : []),
      ],
    },
  );
}
