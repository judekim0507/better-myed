import { json } from '@sveltejs/kit';
import { selectClass, getAssignments, getClasses } from '$lib/server/myed';
import { getSession, relogin, persistSession } from '$lib/server/session';
import { getCached, setCache } from '$lib/server/cache';
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

const OID_PATTERN = /^[A-Za-z0-9]{10,20}$/;

export const GET: RequestHandler = async ({ params, cookies }) => {
	if (!OID_PATTERN.test(params.oid)) {
		return json({ error: 'Invalid class ID' }, { status: 400 });
	}

	let session: any = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	const key = `assignments:${session.cookies.slice(0, 32)}:${params.oid}`;
	const cached = getCached(key);
	if (cached) return json(cached);

	session._formData = JSON.parse(cookies.get('myed_formdata') ?? '{}');

	try {
		const assignments = await fetchAssignments(session, params.oid);
		persistSession(cookies, session);
		setCache(key, assignments, 15);
		return json(assignments);
	} catch {
		const fresh: any = await relogin(cookies);
		if (!fresh) return json({ error: 'Session expired' }, { status: 401 });

		fresh._formData = {};
		try {
			const assignments = await fetchAssignments(fresh, params.oid);
			persistSession(cookies, fresh);
			setCache(key, assignments, 15);
			return json(assignments);
		} catch {
			return json({ error: 'Failed to load assignments' }, { status: 500 });
		}
	}
};
