import { json } from '@sveltejs/kit';
import { getClasses } from '$lib/server/myed';
import { getSession, relogin, persistSession } from '$lib/server/session';
import { getCached, setCache, sessionKey } from '$lib/server/cache';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	let session = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	let key = sessionKey('classes', session.cookies);
	const cached = getCached(key);
	if (cached) return json(cached);

	try {
		const classes = await getClasses(session);
		persistSession(cookies, session as any);
		setCache(key, classes, 30);
		return json(classes);
	} catch {
		session = await relogin(cookies);
		if (!session) return json({ error: 'Session expired' }, { status: 401 });

		key = sessionKey('classes', session.cookies);
		try {
			const classes = await getClasses(session);
			persistSession(cookies, session as any);
			setCache(key, classes, 30);
			return json(classes);
		} catch {
			return json({ error: 'Session expired' }, { status: 401 });
		}
	}
};
