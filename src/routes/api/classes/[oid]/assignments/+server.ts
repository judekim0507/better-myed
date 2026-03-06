import { json } from '@sveltejs/kit';
import { selectClass, getAssignments } from '$lib/server/myed';
import { getSession, relogin, persistSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

async function fetchAssignments(session: any, oid: string) {
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
		const fresh = await relogin(cookies);
		if (!fresh) return json({ error: 'Session expired' }, { status: 401 });

		// Need to re-fetch formdata after relogin
		const { getClasses } = await import('$lib/server/myed');
		await getClasses(fresh);
		Object.assign(session, fresh);

		try {
			const assignments = await fetchAssignments(session, params.oid);
			persistSession(cookies, session);
			return json(assignments);
		} catch {
			return json({ error: 'Failed to load assignments' }, { status: 500 });
		}
	}
};
