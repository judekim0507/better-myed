import { json } from '@sveltejs/kit';
import { getPublishedReports, getReportPdf } from '$lib/server/myed';
import { getSession, relogin, persistSession } from '$lib/server/session';
import { getCached, setCache, sessionKey } from '$lib/server/cache';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	let session: any = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	// Proxy a specific PDF download by report file OID — no caching
	const oid = url.searchParams.get('oid');
	if (oid) {
		if (!/^[A-Za-z0-9]{10,30}$/.test(oid)) {
			return json({ error: 'Invalid report ID' }, { status: 400 });
		}
		try {
			const r = await getReportPdf(session, oid);
			const buffer = await r.arrayBuffer();
			const contentType = r.headers.get('content-type') ?? '';

			if (buffer.byteLength === 0 || contentType.includes('text/html')) {
				return json({ error: 'Download failed' }, { status: 502 });
			}

			return new Response(buffer, {
				headers: {
					'content-type': 'application/pdf',
					'content-disposition': 'attachment; filename="report.pdf"',
				},
			});
		} catch {
			return json({ error: 'Failed to download report' }, { status: 500 });
		}
	}

	let key = sessionKey('reports', session.cookies);
	const cached = getCached(key);
	if (cached) return json(cached);

	try {
		const reports = await getPublishedReports(session);
		persistSession(cookies, session);
		setCache(key, reports, 300);
		return json(reports);
	} catch {
		const fresh: any = await relogin(cookies);
		if (!fresh) return json({ error: 'Session expired' }, { status: 401 });

		key = sessionKey('reports', fresh.cookies);
		try {
			const reports = await getPublishedReports(fresh);
			persistSession(cookies, fresh);
			setCache(key, reports, 300);
			return json(reports);
		} catch {
			return json({ error: 'Failed to load reports' }, { status: 500 });
		}
	}
};
