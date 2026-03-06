import { json } from '@sveltejs/kit';
import { selectClass, getAttendance, getClasses } from '$lib/server/myed';
import { getSession, relogin, persistSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

async function ensureFormData(session: any) {
	if (!session._formData || Object.keys(session._formData).length === 0) {
		await getClasses(session);
	}
}

async function fetchAttendance(session: any, oid: string) {
	await ensureFormData(session);
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
		const fresh: any = await relogin(cookies);
		if (!fresh) return json({ error: 'Session expired' }, { status: 401 });

		fresh._formData = {};
		try {
			const records = await fetchAttendance(fresh, params.oid);
			persistSession(cookies, fresh);
			return json(records);
		} catch {
			return json({ error: 'Failed to load attendance' }, { status: 500 });
		}
	}
};
