const CACHE_NAME = "wpe-cache-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);

      // Best-effort: parse `index.html` to pre-cache Vite hashed assets.
      try {
        const response = await fetch("/index.html", { cache: "no-store" });
        const html = await response.text();

        const assetUrls = new Set(
          Array.from(html.matchAll(/(?:href|src)=\"(\\/assets\\/[^\"\\s>]+)\"/g), (match) => match[1])
        );

        // Best-effort: follow the entry JS and cache any additional JS chunks.
        const jsQueue = [...assetUrls].filter((url) => url.endsWith(".js"));
        const visitedJs = new Set();

        while (jsQueue.length > 0) {
          const url = jsQueue.shift();
          if (!url || visitedJs.has(url)) continue;
          visitedJs.add(url);

          try {
            const js = await (await fetch(url, { cache: "no-store" })).text();
            for (const match of js.matchAll(/\\/(?:assets)\\/[^\"'\\s)]+\\.js/g)) {
              const chunkUrl = match[0];
              if (!assetUrls.has(chunkUrl)) {
                assetUrls.add(chunkUrl);
                jsQueue.push(chunkUrl);
              }
            }
          } catch {
            // ignore
          }
        }

        await cache.addAll([...assetUrls]);
        await cache.put(
          "/index.html",
          new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
        );
      } catch {
        // ignore
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (key === CACHE_NAME ? undefined : caches.delete(key))))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigate());
    return;
  }

  event.respondWith(handleAsset(event));
});

async function handleNavigate() {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch("/index.html", { cache: "no-store" });
    cache.put("/index.html", response.clone());
    return response;
  } catch {
    return (await cache.match("/index.html")) || new Response("Offline", { status: 503 });
  }
}

async function handleAsset(event) {
  const request = event.request;
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    event.waitUntil(networkFetch);
    return cached;
  }

  const response = await networkFetch;
  return response || new Response("Offline", { status: 503 });
}
