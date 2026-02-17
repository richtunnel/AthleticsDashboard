// Image Caching Service Worker
const CACHE_NAME = "image-cache-v1";
const MAX_CACHE_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Images to cache on install
const PRECACHE_IMAGES = ["/uploads/signatures/", "/cache/images/", "/api/images/optimize"];

// Install event - cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Service Worker: Caching core assets");
      // Don't fail if some precache items don't exist yet
      return Promise.allSettled(PRECACHE_IMAGES.map((url) => cache.add(url))).then(() => {
        console.log("Service Worker: Precache completed");
      });
    }),
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Service Worker: Removing old cache", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
});

// Fetch event - handle image requests
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Only handle image requests
  if (isImageRequest(requestUrl)) {
    event.respondWith(
      handleImageRequest(event.request).catch(() => {
        // Fall back to network if cache fails
        return fetch(event.request).catch(() => null);
      }),
    );
  }
});

function isImageRequest(url) {
  return (
    url.pathname.includes("/api/images/optimize") ||
    url.pathname.includes("/uploads/") ||
    url.pathname.includes("/cache/images/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "avif"].some((ext) => url.pathname.endsWith(`.${ext}`))
  );
}

async function handleImageRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    const cachedDate = new Date(cachedResponse.headers.get("date"));
    const now = new Date();

    if (now.getTime() - cachedDate.getTime() < MAX_CACHE_AGE) {
      console.log("Service Worker: Serving cached image", request.url);
      return cachedResponse;
    }
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      console.log("Service Worker: Caching new image", request.url);
      const responseClone = networkResponse.clone();
      cache.put(request, responseClone);
    }

    return networkResponse;
  } catch (error) {
    if (cachedResponse) {
      console.log("Service Worker: Serving stale cache due to network error", request.url);
      return cachedResponse;
    }

    throw error;
  }
}
