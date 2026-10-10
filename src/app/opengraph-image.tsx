import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'Jumps Lab';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * 共有の絵。kkweb.io の一覧では 176px まで縮むので、置くのはアイコン・名前・1行だけ。
 * 地はアイコンの青。字は英字だけなので、next/og の既定の書体で足りる（和文の書体を持たずに済む）。
 * ビルドのときに焼く（public/ を読むので、開くたびに作ると本番で落ちる）
 */
export default async function OpengraphImage() {
  const icon = await readFile(join(process.cwd(), 'public/icon-512x512.png'));
  const src = `data:image/png;base64,${icon.toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 56,
        padding: '0 96px',
        background: '#1e6fd9',
        color: '#ffffff',
      }}
    >
      { }
      <img src={src} width={280} height={280} alt="" style={{ borderRadius: 64 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>Jumps Lab</div>
        <div style={{ fontSize: 40, opacity: 0.9 }}>Log every jump.</div>
      </div>
    </div>,
    size,
  );
}
