import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { login } from '$lib/server/myed';
import { encryptCreds } from '$lib/server/creds';
import type { RequestHandler } from './$types';

// In-memory rate limiter: only failed attempts count, so legitimate users who
// mistype aren't locked out. Successful logins clear the failure counter.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isBlocked(ip: string): boolean {
	const entry = attempts.get(ip);
	return !!entry && Date.now() < entry.resetAt && entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string) {
	const now = Date.now();
	const entry = attempts.get(ip);
	if (!entry || now > entry.resetAt) {
		attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
	} else {
		entry.count++;
	}
}

function clearFailures(ip: string) {
	attempts.delete(ip);
}

const COOKIE_OPTS = {
	path: '/',
	httpOnly: true,
	secure: !dev,
	sameSite: 'lax' as const,
};

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = getClientAddress();
	if (isBlocked(ip)) {
		return json(
			{ error: 'Too many failed attempts. Try again in 15 minutes.' },
			{ status: 429 }
		);
	}

	const { username, password, remember } = await request.json();

	if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const session = await login(username, password);
	if (!session) {
		recordFailure(ip);
		return json({ error: 'Invalid login ID or password.' }, { status: 401 });
	}

	clearFailures(ip);

	cookies.set('myed_session', session.cookies, {
		...COOKIE_OPTS,
		maxAge: 60 * 60,
	});

	if (remember) {
		cookies.set('myed_creds', encryptCreds(username, password), {
			...COOKIE_OPTS,
			maxAge: 60 * 60 * 24 * 7, // 7 days (reduced from 30)
		});
	} else {
		cookies.delete('myed_creds', { path: '/' });
	}

	return json({ ok: true });
};
