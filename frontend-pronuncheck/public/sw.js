const CACHE_NAME = 'pronuncheck-v2';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Bắt buộc Service Worker mới kích hoạt ngay lập tức
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.log('Lỗi cache:', err))
  );
});

self.addEventListener('activate', event => {
  // Xóa bộ nhớ đệm (cache) cũ của phiên bản trước
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Đang xóa cache cũ:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Kiểm soát ngay lập tức các tab đang mở
  );
});

self.addEventListener('fetch', event => {
  // Chỉ can thiệp vào các request GET thông thường
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  // CHIẾN LƯỢC: Network First, Fallback to Cache
  // Luôn cố gắng tải từ server mạng trước tiên để đảm bảo dữ liệu/code mới nhất
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cập nhật lại bản mới nhất này vào Cache để dự phòng khi mất mạng
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Nếu rớt mạng hoặc server chết -> Lấy bản lưu dự phòng từ Cache
        return caches.match(event.request);
      })
  );
});
