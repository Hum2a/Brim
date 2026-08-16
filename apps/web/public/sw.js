self.addEventListener("install", (event) => {
  event.waitUntil(caches.open("brim-shell-v1").then((cache) => cache.addAll(["/", "/index.html", "/manifest.json"])));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const path = new URL(req.url).pathname;
  if (path === "/health" || path.startsWith("/v1/")) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        void caches.open("brim-shell-v1").then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached ?? caches.match("/"))),
  );
});
