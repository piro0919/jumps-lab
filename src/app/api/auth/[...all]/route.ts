import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth';

/**
 * ログインの受け口。Better Auth は要求が来てから作る（読み込みで作ると、鍵を持たないビルドが落ちる）
 */
export async function GET(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).POST(request);
}
