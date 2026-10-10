/**
 * 動画の上限（2026-10-11 に本人と決めた）。画面とサーバーの両方で使うので、server-only にしない。
 * 1本は長さ 60 秒・100MB まで（スマホの 1080p で 60 秒がおよそ 100MB）。1人の合計は 1GB まで。
 * R2 の無料枠 10GB を利用者で分け合うための数。長さはファイルを開いた画面で確かめ、大きさは署名で R2 に守らせる
 */
export const MAX_VIDEO_SECONDS = 60;
/** 1KB・1MB・1GB のバイト数（2進） */
const KIB = 1024;
export const MIB = KIB * KIB;
export const GIB = MIB * KIB;
export const MAX_VIDEO_BYTES = 100 * MIB;
export const USER_VIDEO_BYTES = 1 * GIB;

/** 受け付ける種類。iPhone は mov（quicktime）、Android は mp4、PC のブラウザの録画は webm */
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export type VideoType = (typeof VIDEO_TYPES)[number];

export function isVideoType(value: unknown): value is VideoType {
  return VIDEO_TYPES.includes(value as VideoType);
}

const EXTENSION: Record<VideoType, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/** R2 の置き場所。人ごとにまとめておく（アカウントを消すときに、その人の分をまとめて消せるように） */
export function videoKey(userId: string, id: string, type: VideoType): string {
  return `videos/${userId}/${id}.${EXTENSION[type]}`;
}
