// Musicanaz Service Worker — v2
// Handles caching for offline shell + static assets.
// Does NOT cache music streams (YouTube doesn't allow it).

const CACHE_NAME = "musicanaz-v2"
const SHELL_URLS = [
  "/",
  "/library",
  "/settings",
  "/manifest.json",
]

// Install — pre-cache the app shell
self.addEventListener("install", event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_URLS).catch(() => {})
    })
  )
})

// Activate — clean up old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// Fetch — network-first for API calls, cache-first for static
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url)

  // Never intercept YouTube / Google requests (streams, thumbnails)
  if (
    url.hostname.includes("youtube") ||
    url.hostname.includes("google") ||
    url.hostname.includes("googlevideo") ||
    url.hostname.includes("ytimg")
  ) {
    return
  }

  // Never intercept API calls — always go to network
  if (url.pathname.startsWith("/api/")) {
    return
  }

  // For navigation requests (HTML pages) — network first, fallback to cache
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          }
          return res
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match("/")))
    )
    return
  }

  // Static assets — cache first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          }
          return res
        })
      })
    )
    return
  }
})
