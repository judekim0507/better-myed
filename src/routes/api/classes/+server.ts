import { json } from '@sveltejs/kit';
import { getClasses } from '$lib/server/myed';
import { getSession, relogin, persistSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	let session = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	try {
		const classes = await getClasses(session);
		persistSession(cookies, session as any);
		return json(classes);
	} catch {
		// Session expired — try re-login
		session = await relogin(cookies);
		if (!session) return json({ error: 'Session expired' }, { status: 401 });

		try {
			const classes = await getClasses(session);
			persistSession(cookies, session as any);
			return json(classes);
		} catch {
			return json({ error: 'Session expired' }, { status: 401 });
		}
	}
};
