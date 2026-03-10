import { redirect } from '@sveltejs/kit';
import { getSession } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const session = await getSession(cookies);
	if (!session) {
		throw redirect(302, '/');
	}
};
