import { createPushHandler, isPushServiceEndpoint } from '@piro0919/next-push/server';
import { getAuth } from '@/lib/auth';
import { localeOfRequest } from '@/i18n/locales';
import { deletePushSubscription, savePushSubscription } from '@/lib/data';
import { pushReady } from '@/lib/push';

/**
 * 通知の宛先の受け口（設定の通知のカードの usePush と、public/sw.js の pushsubscriptionchange が呼ぶ）。
 * POST で登録、DELETE で外す。誰の宛先かはログインのセッションで決め、送られてきた userId は信じない
 * （next-push の getUserId）。ログインしていなければ 401。宛先はブラウザ各社の通知サービスだけを受け付ける
 */

const NO_STORE = { 'Cache-Control': 'private, no-store' };

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
/** 通知の鍵が揃っていない */
const UNAVAILABLE = 503;

/** 1回の要求の中でセッションを確かめるのは1度だけ（下の前置きの検査と next-push の getUserId で同じ要求を見る） */
const sessions = new WeakMap<Request, Promise<string | null>>();

function userIdOf(request: Request): Promise<string | null> {
  let found = sessions.get(request);
  if (!found) {
    found = getAuth()
      .api.getSession({ headers: request.headers })
      .then((session) => session?.user.id ?? null);
    sessions.set(request, found);
  }
  return found;
}

const handler = createPushHandler({
  getUserId: userIdOf,
  onSubscribe: async (subscription, request, context) => {
    if (!context?.userId) throw new Error('通知の宛先を、ログインしていない要求から受け取りました');
    await savePushSubscription(context.userId, subscription, localeOfRequest(request.headers));
  },
  onUnsubscribe: async (endpoint, _request, context) => {
    if (!context?.userId)
      throw new Error('通知の宛先を、ログインしていない要求から外そうとしました');
    await deletePushSubscription(context.userId, endpoint);
  },
});

const reply = (status: number) => new Response(null, { status, headers: NO_STORE });

/** next-push の返事に、本人の要求なので控えさせない印を付ける */
async function noStore(response: Promise<Response>): Promise<Response> {
  const { status, body } = await response;
  return new Response(body, { status, headers: NO_STORE });
}

/** 本文の大きさ・形・宛先の検査は next-push の POST がする（3.0.0 から、通知サービス以外の宛先は 400） */
export async function POST(request: Request): Promise<Response> {
  if (!pushReady()) return reply(UNAVAILABLE);
  if ((await userIdOf(request)) === null) return reply(UNAUTHORIZED);
  return noStore(handler.POST(request));
}

/**
 * next-push の DELETE は https:// しか見ないが、ここの行は登録のときに通知サービスだけを通しているので、
 * 外すときも同じ宛先に絞る
 */
export async function DELETE(request: Request): Promise<Response> {
  if ((await userIdOf(request)) === null) return reply(UNAUTHORIZED);
  const endpoint = new URL(request.url).searchParams.get('endpoint');
  if (endpoint === null || !isPushServiceEndpoint(endpoint)) return reply(BAD_REQUEST);
  return noStore(handler.DELETE(request));
}
