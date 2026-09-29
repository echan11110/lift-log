/* Lift Log service worker — offline app shell.
 *
 * Deliberately conservative, because a bad service worker can pin users to a
 * stale build:
 *   - Navigations are network-first and only fall back to the cached shell when
 *     the network fails, so a new deploy is picked up immediately.
 *   - Build assets are content-hashed, so those are safe to serve cache-first.
 *   - Supabase (a different origin) is never touched; writes must never be served
 *     from a cache. Offline writes are handled by the app's own durable queue.
 */

const VERSION = 'v1'
const SHELL_CACHE = `lift-log-shell-${VERSION}`
const ASSET_CACHE = `lift-log-assets-${VERSION}`

// Resolve against the SW's own scope so this works at both / and /lift-log/.
const scoped = path => new URL(path, self.registration.scope).toString()

const SHELL = [
  scoped('./'),
  scoped('./index.html'),
  scoped('./manifest.webmanifest'),
  scoped('./icon.svg'),
  scoped('./icon-192.png'),
  scoped('./apple-touch-icon.png'),
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // Individually, so one missing file can't fail the whole install.
      .then(cache => Promise.allSettled(SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== ASSET_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Only same-origin traffic. Supabase REST/auth calls fall straight through.
  if (url.origin !== self.location.origin) return

  // Navigations: network first, cached shell as the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then(c => c.put(scoped('./index.html'), copy)).catch(() => {})
          return res
        })
        .catch(async () =>
          (await caches.match(scoped('./index.html'))) ??
          (await caches.match(scoped('./'))) ??
          Response.error()
        )
    )
    return
  }

  // Hashed build output: cache first.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then(hit => hit ?? fetch(request).then(res => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(ASSET_CACHE).then(c => c.put(request, copy)).catch(() => {})
        }
        return res
      }))
    )
    return
  }

  // Everything else same-origin (icons, manifest): cache with a network refresh.
  event.respondWith(
    caches.match(request).then(hit => hit ?? fetch(request).catch(() => Response.error()))
  )
})
