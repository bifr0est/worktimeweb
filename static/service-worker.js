// worktimeweb/static/service-worker.js

const CACHE_NAME = 'worktimeweb-shell-v1'; // Change version to force update
const urlsToCache = [
  '/', // The main HTML page
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/icons/icon-192x192.png',
];

// Install event: Cache the app shell
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
          console.error('Service Worker: Caching failed', err);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME]; // Keep only the current cache
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control of open clients immediately
});

// Fetch event: Serve cached content when offline (Cache-First for app shell)
self.addEventListener('fetch', event => {
   // Only handle GET requests for caching strategy
   if (event.request.method !== 'GET') {
       return;
   }

  // Check if the request URL is for one of the shell assets
  const requestUrl = new URL(event.request.url);
  const isShellAsset = urlsToCache.includes(requestUrl.pathname);

  // Use cache-first for app shell assets
  if (isShellAsset) {
      event.respondWith((async () => {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
              return cachedResponse;
          }

          try {
              const networkResponse = await fetch(event.request);
              if (networkResponse?.ok) {
                  const responseToCache = networkResponse.clone();
                  const cache = await caches.open(CACHE_NAME);
                  await cache.put(event.request, responseToCache);
              }
              return networkResponse;
          } catch (error) {
              console.error('Service Worker: Fetching failed', error);
              // Optional: Return a fallback offline page here
          }
      })());
  } else {
      // For non-shell assets (like the /calculate API call),
      // just fetch from the network (network-first or network-only).
      // Offline calculation requires more complex logic here or in app.js.
      // console.log(`Service Worker: Fetching non-shell asset: ${event.request.url}`);
      event.respondWith(fetch(event.request));
  }
});