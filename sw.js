/* Sadə service worker: yalnız "tətbiq kimi yüklə" üçün lazımdır, heç nəyi keşləmir (köhnə fayl problemi olmasın) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request)); });
