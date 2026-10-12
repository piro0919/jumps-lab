import { SHARE_IMAGE_SIZE, shareImage } from './share-image';

export const alt = 'Jumps Lab — Built for every jump.';
export const size = SHARE_IMAGE_SIZE;
export const contentType = 'image/png';

/** 共有の絵（英語）。描き方は src/app/share-image.tsx。日本語の LP（/ja）は日本語の絵を持つ */
export default function OpengraphImage() {
  return shareImage('en');
}
