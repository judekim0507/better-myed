import { json } from '@sveltejs/kit';
import { getLocker } from '$lib/server/myed';
import { getSession, relogin } from '$lib/server/session';
import { getCached, setCache } from '$lib/server/cache';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	let session = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	const key = `locker:${session.cookies.slice(0, 32)}`;
	const cached = getCached(key);
	if (cached) return json(cached);

	try {
		const data = await getLocker(session);
		setCache(key, data, 120);
		return json(data);
	} catch {
		session = await relogin(cookies);
		if (!session) return json({ error: 'Session expired' }, { status: 401 });
		try {
			const data = await getLocker(session);
			setCache(key, data, 120);
			return json(data);
		} catch {
			return json({ error: 'Session expired' }, { status: 401 });
		}
	}
};
