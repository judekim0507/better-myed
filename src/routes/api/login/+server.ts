import { json } from '@sveltejs/kit';
import { login } from '$lib/server/myed';
import { encryptCreds } from '$lib/server/creds';
import type { RequestHandler } from './$types';

// Simple in-memory rate limiter: max 5 attempts per IP per 15 minutes
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = attempts.get(ip);
	if (!entry || now > entry.resetAt) {
		attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return true;
	}
	entry.count++;
	return entry.count <= MAX_ATTEMPTS;
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = getClientAddress();
	if (!checkRateLimit(ip)) {
		return json({ error: 'Too many login attempts. Try again later.' }, { status: 429 });
	}

	const { username, password, remember } = await request.json();

	if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const session = await login(username, password);
	if (!session) {
		return json({ error: 'Login failed' }, { status: 401 });
	}

	cookies.set('myed_session', session.cookies, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 60 * 60,
	});

	if (remember) {
		cookies.set('myed_creds', encryptCreds(username, password), {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7, // 7 days (reduced from 30)
		});
	} else {
		cookies.delete('myed_creds', { path: '/' });
	}

	return json({ ok: true });
};
