import { describe, expect, it } from 'vitest';
import { isVideoType, MAX_VIDEO_BYTES, USER_VIDEO_BYTES, videoKey } from '@/lib/videos';

describe('動画の上限と置き場所', () => {
  it('iPhone・Android・PC の録画の種類だけを受け付ける', () => {
    expect(isVideoType('video/quicktime')).toBe(true);
    expect(isVideoType('video/mp4')).toBe(true);
    expect(isVideoType('video/webm')).toBe(true);
    expect(isVideoType('video/x-msvideo')).toBe(false);
    expect(isVideoType('')).toBe(false);
  });

  it('置き場所は人ごとにまとめ、種類から拡張子を付ける', () => {
    expect(videoKey('u1', 'v1', 'video/quicktime')).toBe('videos/u1/v1.mov');
    expect(videoKey('u1', 'v1', 'video/mp4')).toBe('videos/u1/v1.mp4');
  });

  it('1人の合計は1本の上限の10本分', () => {
    expect(USER_VIDEO_BYTES / MAX_VIDEO_BYTES).toBeCloseTo(10.24);
  });
});
