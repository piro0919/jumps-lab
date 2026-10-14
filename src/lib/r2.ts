import 'server-only';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  NotFound,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/env';

/** 1回でまとめて消せる数（S3 と R2 の DeleteObjects の上限） */
const DELETE_BATCH_SIZE = 1000;

/** 送るための署名 URL の期限（30分） */
const UPLOAD_URL_MINUTES = 30;
const UPLOAD_URL_SECONDS = UPLOAD_URL_MINUTES * 60;

let client: S3Client | undefined;

/**
 * 動画の置き場（Cloudflare R2。S3 と同じ作法で話す。onigiri の src/lib/r2.ts と同じ作り）。
 * バケットは非公開で、送るのも見るのも、サーバーが作る期限つきの署名 URL を通す。
 * 動画は大きいので、関数を通さずブラウザから R2 へ直接送る（Vercel の関数の本文は 4.5MB まで）。
 * そのためバケットの CORS で、本番は jumpslab.kkweb.io、手元は localhost:3110 と 3312 の PUT を許してある
 */
function r2(): { client: S3Client; bucket: string } {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error(
      '動画の置き場の鍵がありません: R2_ENDPOINT・R2_ACCESS_KEY_ID・R2_SECRET_ACCESS_KEY・R2_BUCKET を入れてください',
    );
  }
  client ??= new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return { client, bucket: R2_BUCKET };
}

/**
 * ブラウザが1本を直接送るための署名 URL。大きさと種類も署名に含めるので、
 * 申告と違う大きさや種類のファイルは R2 が受け付けない
 */
export async function uploadUrl(key: string, sizeBytes: number, contentType: string) {
  const { client, bucket } = r2();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentLength: sizeBytes,
      ContentType: contentType,
    }),
    // SDK は既定で Content-Type を署名に入れないので、入れるよう指定する（入れないと別の種類で送れる）
    { expiresIn: UPLOAD_URL_SECONDS, signableHeaders: new Set(['content-type']) },
  );
}

/** 見るための署名 URL。画面を開くたびに作り直すので、期限は短くてよい */
export async function viewUrl(key: string): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 60 * 60,
  });
}

/**
 * 端末に保存するための署名 URL。開くと再生せずに保存する（Content-Disposition: attachment）。
 * 動画は期限で消えるので、残したい人が手元に移せるように
 */
export async function downloadUrl(key: string, filename: string): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: 60 * 60 },
  );
}

/** 届いたファイルの大きさ。無ければ null。通信の失敗などは投げる（「無い」と取り違えて、届いた分を置き去りにしないように） */
export async function objectSize(key: string): Promise<number | null> {
  const { client, bucket } = r2();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength ?? null;
  } catch (error) {
    if (error instanceof NotFound) return null;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = r2();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * まとめて消す（アカウントを消すとき）。上限の数ずつに分けて送る。
 * 消せなかった置き場所の数を返す（中身は返さない。ログに置き場所を並べないため）。通信の失敗は投げる
 */
export async function deleteObjects(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const { client, bucket } = r2();
  let failed = 0;
  for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
    const batch = keys.slice(start, start + DELETE_BATCH_SIZE);
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    failed += result.Errors?.length ?? 0;
  }
  return failed;
}
