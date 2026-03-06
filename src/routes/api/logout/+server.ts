import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete('myed_session', { path: '/' });
	cookies.delete('myed_formdata', { path: '/' });
	cookies.delete('myed_token', { path: '/' });
	cookies.delete('myed_creds', { path: '/' });
	return json({ ok: true });
};
