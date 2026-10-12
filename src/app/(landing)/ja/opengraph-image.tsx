import { SHARE_IMAGE_SIZE, shareImage } from '../../share-image';

export const alt = 'Jumps Lab — 跳躍の、一本一本のために。';
export const size = SHARE_IMAGE_SIZE;
export const contentType = 'image/png';

/** 日本語の LP（/ja）の共有の絵。描き方は src/app/share-image.tsx */
export default function OpengraphImage() {
  return shareImage('ja');
}
