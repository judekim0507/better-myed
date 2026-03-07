import { json } from '@sveltejs/kit';
import { getClassDetail } from '$lib/server/myed';
import { getSession, relogin, persistSession } from '$lib/server/session';
import { getCached, setCache } from '$lib/server/cache';
import type { RequestHandler } from './$types';

const OID_PATTERN = /^[A-Za-z0-9]{10,20}$/;

export const GET: RequestHandler = async ({ params, cookies }) => {
	if (!OID_PATTERN.test(params.oid)) {
		return json({ error: 'Invalid class ID' }, { status: 400 });
	}

	let session: any = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	const key = `detail:${session.cookies.slice(0, 32)}:${params.oid}`;
	const cached = getCached(key);
	if (cached) return json(cached);

	// Class should already be selected by the assignments fetch
	try {
		const detail = await getClassDetail(session);
		persistSession(cookies, session);
		setCache(key, detail, 15);
		return json(detail);
	} catch {
		const fresh: any = await relogin(cookies);
		if (!fresh) return json({ error: 'Session expired' }, { status: 401 });

		try {
			const detail = await getClassDetail(fresh);
			persistSession(cookies, fresh);
			setCache(key, detail, 15);
			return json(detail);
		} catch {
			return json({ error: 'Failed to load class detail' }, { status: 500 });
		}
	}
};
