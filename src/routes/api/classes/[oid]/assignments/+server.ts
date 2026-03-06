import { json } from '@sveltejs/kit';
import { selectClass, getAssignments, getClasses } from '$lib/server/myed';
import { getSession, relogin, persistSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

async function ensureFormData(session: any) {
	if (!session._formData || Object.keys(session._formData).length === 0) {
		await getClasses(session);
	}
}

async function fetchAssignments(session: any, oid: string) {
	await ensureFormData(session);
	await selectClass(session, oid);
	return getAssignments(session);
}

export const GET: RequestHandler = async ({ params, cookies }) => {
	let session: any = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	session._formData = JSON.parse(cookies.get('myed_formdata') ?? '{}');

	try {
		const assignments = await fetchAssignments(session, params.oid);
		persistSession(cookies, session);
		return json(assignments);
	} catch {
		const fresh: any = await relogin(cookies);
		if (!fresh) return json({ error: 'Session expired' }, { status: 401 });

		fresh._formData = {};
		try {
			const assignments = await fetchAssignments(fresh, params.oid);
			persistSession(cookies, fresh);
			return json(assignments);
		} catch {
			return json({ error: 'Failed to load assignments' }, { status: 500 });
		}
	}
};
