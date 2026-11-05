const CACHE = "royalsg-pwa-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(["/offline.html", "/logo.png"]))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("royalsg-pwa-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  if (url.pathname === "/offline.html" || url.pathname === "/logo.png") {
    event.respondWith(
      caches
        .open(CACHE)
        .then(
          async (cache) =>
            (await cache.match(event.request)) || fetch(event.request),
        ),
    );
  } else if (
    event.request.mode === "navigate" &&
    url.pathname !== "/auth/callback"
  ) {
    // Never store authenticated pages, APIs or OAuth callback responses.
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.open(CACHE).then((cache) => cache.match("/offline.html")),
      ),
    );
  }
});
