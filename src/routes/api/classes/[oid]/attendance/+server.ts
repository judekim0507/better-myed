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

const OID_PATTERN = /^[A-Za-z0-9]{10,20}$/;

export const GET: RequestHandler = async ({ params, cookies }) => {
	if (!OID_PATTERN.test(params.oid)) {
		return json({ error: 'Invalid class ID' }, { status: 400 });
	}

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
