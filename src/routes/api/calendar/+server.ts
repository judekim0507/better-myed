import { json } from '@sveltejs/kit';
import { getCalendar, navigateCalendarMonth } from '$lib/server/myed';
import { getSession, relogin, persistSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	let session: any = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	const direction = url.searchParams.get('dir') as 'prev' | 'next' | null;

	try {
		const data = direction
			? await navigateCalendarMonth(session, direction)
			: await getCalendar(session);
		persistSession(cookies, session);
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
