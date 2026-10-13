import { unstable_rethrow } from 'next/navigation';

/** 呼び出しが届かなかったときの値。画面は errors.generic（保存できませんでした。もう一度）を出す */
const UNREACHED: { ok: false; error: string } = { ok: false, error: 'generic' };

/**
 * ブラウザから Server Action を呼ぶときは、かならずこれを通す（test/client-actions.test.ts が見る）。
 *
 * 電波が切れる・サーバーが落ちるなどで呼び出しが投げられると、そのままではフォームの action ごと落ち、
 * 書いた文が消えるか、ボタンが戻るだけで何も出ない。本人は保存できたと思って画面を離れる
 * （nagara-kaigo が同じ壊れ方を6回直した。scripts/check-unguarded-write.mjs）。
 * 投げられたら汎用の誤りの値にして、フォームの誤りの欄に出す。
 * Next の redirect と notFound は投げ直す（保存のあとにホームへ送る action がある）
 */
export async function safely<T>(call: () => Promise<T>): Promise<T | typeof UNREACHED> {
  try {
    return await call();
  } catch (error) {
    unstable_rethrow(error);
    return UNREACHED;
  }
}
