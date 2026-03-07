import { json } from '@sveltejs/kit';
import { getCalendar, navigateCalendarMonth } from '$lib/server/myed';
import { getSession, relogin, persistSession } from '$lib/server/session';
import { getCached, setCache } from '$lib/server/cache';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	let session: any = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	const dirRaw = url.searchParams.get('dir');
	if (dirRaw && dirRaw !== 'prev' && dirRaw !== 'next') {
		return json({ error: 'Invalid direction' }, { status: 400 });
	}
	const direction = dirRaw as 'prev' | 'next' | null;

	// Only cache the default calendar view (no navigation)
	if (!direction) {
		const key = `calendar:${session.cookies.slice(0, 32)}`;
		const cached = getCached(key);
		if (cached) return json(cached);
	}

	try {
		const data = direction
			? await navigateCalendarMonth(session, direction)
			: await getCalendar(session);
		persistSession(cookies, session);
		if (!direction) setCache(`calendar:${session.cookies.slice(0, 32)}`, data, 120);
		return json(data);
	} catch {
		const fresh: any = await relogin(cookies);
		if (!fresh) return json({ error: 'Session expired' }, { status: 401 });

		try {
			const data = direction
				? await navigateCalendarMonth(fresh, direction)
				: await getCalendar(fresh);
			persistSession(cookies, fresh);
			return json(data);
		} catch {
			return json({ error: 'Failed to load calendar' }, { status: 500 });
		}
	}
};
