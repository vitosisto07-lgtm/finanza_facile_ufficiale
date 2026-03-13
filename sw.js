const CACHE_NAME = 'finanza-facile-v3';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './avatar.png'
];

// Installazione: cache dei file statici
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Attivazione: pulizia vecchie cache
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: strategie differenziate
self.addEventListener('fetch', (e) => {
    // Escludi le chiamate a Supabase dalla cache
    if (e.request.url.includes('supabase.co')) {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then((response) => {
                // Se la rete risponde, aggiorna la cache e restituisci
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Se la rete fallisce, prova la cache
                return caches.match(e.request);
            })
    );
});
