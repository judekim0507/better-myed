import { json } from '@sveltejs/kit';
import { getAttendance } from '$lib/server/myed';
import { getSession, relogin } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	let session = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	try {
		return json(await getAttendance(session));
	} catch {
		session = await relogin(cookies);
		if (!session) return json({ error: 'Session expired' }, { status: 401 });
		try {
			return json(await getAttendance(session));
		} catch {
			return json({ error: 'Session expired' }, { status: 401 });
		}
	}
};
