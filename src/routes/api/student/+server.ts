import { json } from '@sveltejs/kit';
import { getStudentInfo } from '$lib/server/myed';
import { getSession, relogin } from '$lib/server/session';
import { getCached, setCache, sessionKey } from '$lib/server/cache';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	let session = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	let key = sessionKey('student', session.cookies);
	const cached = getCached(key);
	if (cached) return json(cached);

	try {
		const data = await getStudentInfo(session);
		setCache(key, data, 300);
		return json(data);
	} catch {
		session = await relogin(cookies);
		if (!session) return json({ error: 'Session expired' }, { status: 401 });
		key = sessionKey('student', session.cookies);
		try {
			const data = await getStudentInfo(session);
			setCache(key, data, 300);
			return json(data);
		} catch {
			return json({ error: 'Session expired' }, { status: 401 });
		}
	}
};
