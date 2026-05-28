// ============================================================
// Opletics Service Worker  v2
// ============================================================
// Principles followed:
//   1. Version everything   — SW_VERSION + CACHE_NAME are versioned
//   2. Never assume immediate activation — skipWaiting() only on explicit request
//   3. Atomic updates       — CACHE_NAME bump ensures clean swap
//   4. Idempotent events    — notificationclick focuses existing window if open
//   5. Graceful fallback    — all push/notification code wrapped in try/catch
//   6. Explicit client coordination — postMessage protocol (SKIP_WAITING, VERSION_CHECK)
//   7. Short-lived stateless — no persistent in-SW state; each event is standalone
// ============================================================

const SW_VERSION = "v2";
const CACHE_NAME = "opletics-images-v2";
const MAX_CACHE_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---------------------------------------------------------------------------
// Install — open new cache, skip waiting only when explicitly told to
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  // Principle 2: do NOT call skipWaiting() here; wait for client postMessage
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-warm entries that are likely to exist; don't fail on missing ones
      return Promise.allSettled([
        cache.add("/uploads/signatures/"),
        cache.add("/cache/images/"),
      ]).then(() => {
        console.log(`[SW ${SW_VERSION}] install complete`);
      });
    })
  );
});

// ---------------------------------------------------------------------------
// Activate — claim all clients, evict stale caches (principle 3)
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n !== CACHE_NAME)
            .map((n) => {
              console.log(`[SW ${SW_VERSION}] deleting old cache: ${n}`);
              return caches.delete(n);
            })
        )
      )
      .then(() => {
        console.log(`[SW ${SW_VERSION}] activate — claiming clients`);
        return self.clients.claim(); // Principle 2
      })
  );
});

// ---------------------------------------------------------------------------
// Fetch — stale-while-revalidate image cache (unchanged from v1)
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  // Only handle simple GET image fetches. PUT/POST/DELETE/HEAD etc. (e.g. the
  // presigned PUT we use to upload posts to DigitalOcean Spaces) must pass
  // through untouched — running them through `_handleImageRequest` produces
  // an invalid Response and breaks uploads with
  // "TypeError: Failed to convert value to 'Response'".
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (_isImageRequest(url)) {
    event.respondWith(
      _handleImageRequest(event.request).catch(() =>
        fetch(event.request).catch(() => null)
      )
    );
  }
});

function _isImageRequest(url) {
  return (
    url.pathname.includes("/api/images/optimize") ||
    url.pathname.includes("/uploads/") ||
    url.pathname.includes("/cache/images/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "avif"].some((ext) =>
      url.pathname.endsWith(`.${ext}`)
    )
  );
}

async function _handleImageRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    const age = Date.now() - new Date(cached.headers.get("date") || 0).getTime();
    if (age < MAX_CACHE_AGE) return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (cached) return cached;
    throw new Error("Network request failed and no cached version available");
  }
}

// ---------------------------------------------------------------------------
// Notification click — focus existing tab or open /dashboard/messages
// (Principle 4: idempotent — checks for open window first)
// ---------------------------------------------------------------------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetPath = event.notification.data?.url || "/dashboard/messages";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Re-focus if the tab is already open
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url);
            if (
              clientUrl.pathname.startsWith("/dashboard") &&
              "focus" in client
            ) {
              client.postMessage({
                type: "NOTIFICATION_CLICK",
                url: targetPath,
              });
              return client.focus();
            }
          } catch {
            // Ignore cross-origin or malformed URLs
          }
        }
        // No matching tab — open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetPath);
        }
      })
  );
});

// ---------------------------------------------------------------------------
// postMessage — client ↔ SW coordination (Principle 6)
//
//   { type: 'SKIP_WAITING' }  — apply waiting update immediately
//   { type: 'VERSION_CHECK' } — reply with current version
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    console.log(`[SW ${SW_VERSION}] SKIP_WAITING received — activating now`);
    self.skipWaiting();
  }

  if (event.data.type === "VERSION_CHECK") {
    const source = event.source;
    if (source && "postMessage" in source) {
      source.postMessage({ type: "VERSION_REPLY", version: SW_VERSION });
    }
  }
});
