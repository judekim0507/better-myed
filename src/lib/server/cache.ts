import { createHash } from 'crypto';

const cache = new Map<string, { data: unknown; expires: number }>();

/** Hash the full session cookie string into a safe, unique cache key. */
export function sessionKey(prefix: string, sessionCookies: string, ...parts: string[]): string {
	const hash = createHash('sha256').update(sessionCookies).digest('hex').slice(0, 16);
	return [prefix, hash, ...parts].join(':');
}

export function getCached<T>(key: string): T | null {
	const entry = cache.get(key);
	if (!entry) return null;
	if (Date.now() > entry.expires) {
		cache.delete(key);
		return null;
	}
	return entry.data as T;
}

export function setCache(key: string, data: unknown, ttlSeconds: number) {
	cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}
