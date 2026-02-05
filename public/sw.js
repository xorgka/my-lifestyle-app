/**
 * PWA Service Worker (최소 등록용)
 * 설치 가능 조건 충족 + 필요 시 캐시 확장
 */
const CACHE_NAME = "my-lifestyle-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", () => {
  // 네트워크 우선 (캐시 미사용). 오프라인 캐시가 필요하면 여기서 처리
});
