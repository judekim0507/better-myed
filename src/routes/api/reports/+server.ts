import { json } from '@sveltejs/kit';
import { getPublishedReports, getReportPdf } from '$lib/server/myed';
import { getSession, relogin, persistSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	let session: any = await getSession(cookies);
	if (!session) return json({ error: 'Not logged in' }, { status: 401 });

	// Proxy a specific PDF download by report file OID
	const oid = url.searchParams.get('oid');
	if (oid) {
		try {
			const r = await getReportPdf(session, oid);
			const buffer = await r.arrayBuffer();
			const contentType = r.headers.get('content-type') ?? '';
			const disposition = r.headers.get('content-disposition');

			if (buffer.byteLength === 0 || contentType.includes('text/html')) {
				return json({ error: 'Download failed — empty or HTML response' }, { status: 502 });
			}

			return new Response(buffer, {
				headers: {
					'content-type': contentType,
					'content-disposition': disposition ?? 'attachment; filename="report.pdf"',
				},
			});
		} catch (e) {
			return json({ error: 'Failed to download report: ' + String(e) }, { status: 500 });
		}
	}

	try {
		const reports = await getPublishedReports(session);
		persistSession(cookies, session);
		return json(reports);
	} catch {
		const fresh: any = await relogin(cookies);
		if (!fresh) return json({ error: 'Session expired' }, { status: 401 });

		try {
			const reports = await getPublishedReports(fresh);
			persistSession(cookies, fresh);
			return json(reports);
		} catch {
			return json({ error: 'Failed to load reports' }, { status: 500 });
		}
	}
};
