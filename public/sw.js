/*
 * 通知（Web Push）を受けるためだけの Service Worker。@piro0919/next-push の雛形（templates/sw.js）と
 * 鯉魂の public/sw.js を元に手で書いた。登録するのは設定の通知のカードだけ（src/components/push-setting.tsx）。
 *
 * **何も控えない。fetch も受けない。** 記録はログインした本人のもので、端末の Cache Storage に残すと
 * 同じ端末の次の人に見える。控える Service Worker は comic-time で事故が続いて外した。
 * 小さく保ち、いつでも自分を外すだけの版に差し替えられるようにする
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }
  event.waitUntil(
    self.registration.showNotification(payload?.title ?? 'Jumps Lab', {
      body: payload?.body,
      icon: payload?.icon ?? '/icon-192x192.png',
      tag: payload?.tag,
      data: { url: payload?.url ?? '/' },
    }),
  );
});

/* 押したら、開いているこのサイトの画面を前に出して送り先へ移す。無ければ開く */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? '/', self.location.origin);
  // 送り先はこのサイトの中だけ
  const url = target.origin === self.location.origin ? target.href : self.location.origin;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        return client.navigate(url).catch(() => self.clients.openWindow(url));
      }
      return self.clients.openWindow(url);
    })(),
  );
});

/*
 * 宛先がブラウザの都合で差し替わったとき。古い宛先の鍵で取り直し、新しい宛先を登録し直す
 * （ログインの Cookie が付くので、同じ人の行になる）。古い宛先の行は、送ったときに無効と返されて消える
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      let next = event.newSubscription;
      if (!next) {
        const key = event.oldSubscription?.options?.applicationServerKey;
        if (!key) return;
        next = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
      }
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next.toJSON()),
      });
    })(),
  );
});
