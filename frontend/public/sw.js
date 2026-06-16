const CACHE_NAME = 'sigba-static-v2';
const APP_SHELL = ['/', '/offline.html', '/favicon.svg', '/manifest.webmanifest'];
const SENSITIVE_PATHS = ['/api'];

function shouldBypassCache(requestUrl, request) {
  return (
    request.method !== 'GET' ||
    SENSITIVE_PATHS.some((path) => requestUrl.pathname.startsWith(path)) ||
    request.headers.has('authorization')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SIGBA_SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin || shouldBypassCache(url, event.request)) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          return response;
        })
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response.ok && (url.pathname.startsWith('/assets/') || APP_SHELL.includes(url.pathname))) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }

          return response;
        })
        .catch(() => caches.match('/offline.html'));
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'SIGBA',
      body: event.data?.text() || 'Ha uma nova atualizacao no portal.',
    };
  }

  const title = payload.title || 'SIGBA';
  const options = {
    body: payload.body || 'Ha uma nova atualizacao no portal.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: payload.tag || 'sigba-portal-tutor',
    requireInteraction: payload.requireInteraction === true,
    data: {
      url: payload.url || '/?view=portal',
      notification_id: payload.notification_id || null,
      ref_tipo: payload.ref_tipo || null,
      ref_id: payload.ref_id || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/?view=portal';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existingClient = clientList.find((client) => client.url.includes(self.location.origin));

      if (existingClient) {
        existingClient.focus();
        return existingClient.navigate(targetUrl);
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
