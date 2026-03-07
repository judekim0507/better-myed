/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `cache-${version}`;
const API_CACHE = `api-${version}`;
const ASSETS = [...build, ...files];

// Install: cache all static assets
sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => sw.skipWaiting())
	);
});

// Activate: clean old caches
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((key) => key !== CACHE && key !== API_CACHE).map((key) => caches.delete(key)))
		).then(() => sw.clients.claim())
	);
});

// Fetch: serve cached assets, stale-while-revalidate for API, network-first for pages
sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// API routes: stale-while-revalidate
	if (url.pathname.startsWith('/api/')) {
		// Skip login/logout — never cache auth
		if (url.pathname.startsWith('/api/login') || url.pathname.startsWith('/api/logout')) return;
		// Skip report PDF downloads
		if (url.pathname.startsWith('/api/reports') && url.searchParams.has('oid')) return;

		event.respondWith(
			(async () => {
				const cache = await caches.open(API_CACHE);
				const cached = await cache.match(event.request);

				const networkFetch = fetch(event.request).then((response) => {
					if (response.ok) {
						cache.put(event.request, response.clone());
					}
					return response;
				}).catch(() => null);

				// If we have a cached response, return it immediately
				// and update in background
				if (cached) {
					networkFetch; // fire and forget
					return cached;
				}

				// No cache — must wait for network
				const response = await networkFetch;
				if (response) return response;

				return new Response(JSON.stringify({ error: 'Offline' }), {
					status: 503,
					headers: { 'Content-Type': 'application/json' }
				});
			})()
		);
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// For cached static assets, serve from cache
			if (ASSETS.includes(url.pathname)) {
				const cached = await cache.match(event.request);
				if (cached) return cached;
			}

			// Network first for pages
			try {
				const response = await fetch(event.request);
				if (response.ok && response.type === 'basic') {
					cache.put(event.request, response.clone());
				}
				return response;
			} catch {
				const cached = await cache.match(event.request);
				if (cached) return cached;

				// Offline fallback: serve the dashboard shell if it's a navigation
				if (event.request.mode === 'navigate') {
					const dashCached = await cache.match('/dashboard');
					if (dashCached) return dashCached;
					const rootCached = await cache.match('/');
					if (rootCached) return rootCached;
				}

				return new Response('Offline', { status: 503 });
			}
		})()
	);
});
