import type { Cookies } from '@sveltejs/kit';
import { login, type MyEdSession } from './myed';
import { decryptCreds } from './creds';

/**
 * Get a valid session, auto-re-logging in if needed.
 * Returns null if no session and no saved creds.
 */
export async function getSession(cookies: Cookies): Promise<MyEdSession | null> {
	const sessionCookies = cookies.get('myed_session');
	if (sessionCookies) {
		return { cookies: sessionCookies, token: cookies.get('myed_token') };
	}

	// Try auto-re-login with saved creds
	return relogin(cookies);
}

/**
 * Re-login using saved encrypted credentials.
 */
export async function relogin(cookies: Cookies): Promise<MyEdSession | null> {
	const encCreds = cookies.get('myed_creds');
	if (!encCreds) return null;

	const creds = decryptCreds(encCreds);
	if (!creds) return null;

	const session = await login(creds.username, creds.password);
	if (!session) return null;

	cookies.set('myed_session', session.cookies, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60,
	});

	return session;
}

/**
 * Persist session cookies/token/formdata after API calls.
 */
export function persistSession(cookies: Cookies, session: MyEdSession & { _formData?: Record<string, string> }) {
	cookies.set('myed_session', session.cookies, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60,
	});
	if (session._formData) {
		cookies.set('myed_formdata', JSON.stringify(session._formData), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60,
		});
	}
	if (session.token) {
		cookies.set('myed_token', session.token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60,
		});
	}
}
