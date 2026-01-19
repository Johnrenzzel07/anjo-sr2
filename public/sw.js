const CACHE_NAME = 'srs-cache-v2'; // Increment version to force cache clear
const urlsToCache = [
    '/logo.png',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    // Skip waiting to activate new service worker immediately
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // NEVER cache Next.js build files (/_next/)
    if (url.pathname.startsWith('/_next/')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // For other requests, use cache-first strategy for static assets only
    if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2)$/)) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
    } else {
        // For HTML/API requests, always fetch from network
        event.respondWith(fetch(event.request));
    }
});

self.addEventListener('activate', (event) => {
    // Take control of all clients immediately
    event.waitUntil(
        Promise.all([
            // Clear all old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Claim all clients immediately
            self.clients.claim()
        ])
    );
});
