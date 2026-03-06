import { json } from '@sveltejs/kit';
import { login } from '$lib/server/myed';
import { encryptCreds } from '$lib/server/creds';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { username, password, remember } = await request.json();

	const session = await login(username, password);
	if (!session) {
		return json({ error: 'Login failed' }, { status: 401 });
	}

	cookies.set('myed_session', session.cookies, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60,
	});

	if (remember) {
		cookies.set('myed_creds', encryptCreds(username, password), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30, // 30 days
		});
	} else {
		cookies.delete('myed_creds', { path: '/' });
	}

	return json({ ok: true });
};
