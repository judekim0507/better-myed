import { json } from '@sveltejs/kit';
import { selectClass, getAttendance } from '$lib/server/myed';
import { getSession, relogin, persistSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

async function fetchAttendance(session: any, oid: string) {
	await selectClass(session, oid);
	return getAttendance(session);
}

export const GET: RequestHandler = async ({ params, cookies }) => {
	let session: any = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	session._formData = JSON.parse(cookies.get('myed_formdata') ?? '{}');

	try {
		const records = await fetchAttendance(session, params.oid);
		persistSession(cookies, session);
		return json(records);
	} catch {
		const fresh = await relogin(cookies);
		if (!fresh) return json({ error: 'Session expired' }, { status: 401 });

		const { getClasses } = await import('$lib/server/myed');
		await getClasses(fresh);
		Object.assign(session, fresh);

		try {
			const records = await fetchAttendance(session, params.oid);
			persistSession(cookies, session);
			return json(records);
		} catch {
			return json({ error: 'Failed to load attendance' }, { status: 500 });
		}
	}
};
