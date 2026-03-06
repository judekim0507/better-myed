import * as cheerio from 'cheerio';

const BASE_URL = 'https://myeducation.gov.bc.ca/aspen';

export interface MyEdSession {
	cookies: string;
	token?: string;
}

export interface ClassInfo {
	oid: string;
	name: string;
	term: string;
	teacher: string;
	room: string;
	grade: string | null;
}

export interface Assignment {
	name: string;
	due: string;
	pct: string;
	score: string;
	feedback: string;
}

function extractCookies(response: Response, existing: string): string {
	const setCookies = response.headers.getSetCookie?.() ?? [];
	const cookieMap = new Map<string, string>();

	// Parse existing cookies
	for (const pair of existing.split(';')) {
		const trimmed = pair.trim();
		if (trimmed.includes('=')) {
			const [name, ...rest] = trimmed.split('=');
			cookieMap.set(name.trim(), rest.join('='));
		}
	}

	// Parse new set-cookie headers
	for (const sc of setCookies) {
		const parts = sc.split(';')[0];
		if (parts.includes('=')) {
			const [name, ...rest] = parts.split('=');
			cookieMap.set(name.trim(), rest.join('='));
		}
	}

	return Array.from(cookieMap.entries())
		.map(([k, v]) => `${k}=${v}`)
		.join('; ');
}

function extractFormData(html: string, formName: string): Record<string, string> {
	const $ = cheerio.load(html);
	const data: Record<string, string> = {};
	const form = $(`form[name="${formName}"]`);
	form.find('input[type="hidden"]').each((_, el) => {
		const name = $(el).attr('name');
		const value = $(el).attr('value') ?? '';
		if (name) data[name] = value;
	});
	return data;
}

function extractToken(html: string): string | undefined {
	const $ = cheerio.load(html);
	return $('input[name="org.apache.struts.taglib.html.TOKEN"]').attr('value');
}

export async function login(
	username: string,
	password: string
): Promise<MyEdSession | null> {
	let cookies = '';

	// Step 1: Invalidate existing SSO
	const r1 = await fetch(`${BASE_URL}/rest/vithar/ssoVerify/invalidate`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ withCredentials: true }),
		redirect: 'manual',
	});
	cookies = extractCookies(r1, cookies);

	// Step 2: Auth via REST API -> JWT
	const r2 = await fetch('https://myeducation.gov.bc.ca/app/rest/auth', {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			accept: 'application/json',
			deploymentid: 'aspen',
			cookie: cookies,
		},
		body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
		redirect: 'manual',
	});
	cookies = extractCookies(r2, cookies);

	if (r2.status !== 200) return null;

	const authData = await r2.json();
	const token = authData.authToken ?? authData.token;
	if (!token) return null;

	// Step 3: Exchange token for Aspen session
	const ssoUrl = `https://myeducation.gov.bc.ca/app/rest/aspen/sso?authToken=${encodeURIComponent(token)}&deploymentId=aspen`;
	let r3 = await fetch(ssoUrl, {
		headers: { cookie: cookies },
		redirect: 'manual',
	});
	cookies = extractCookies(r3, cookies);

	// Follow redirects manually to capture all cookies
	let maxRedirects = 5;
	while (maxRedirects-- > 0 && (r3.status === 302 || r3.status === 307)) {
		const location = r3.headers.get('location');
		if (!location) break;
		const url = location.startsWith('http')
			? location
			: `https://myeducation.gov.bc.ca${location}`;
		r3 = await fetch(url, {
			headers: { cookie: cookies },
			redirect: 'manual',
		});
		cookies = extractCookies(r3, cookies);
	}

	return { cookies };
}

export async function getClasses(session: MyEdSession): Promise<ClassInfo[]> {
	const r = await fetch(
		`${BASE_URL}/portalClassList.do?navkey=academics.classes.list`,
		{ headers: { cookie: session.cookies }, redirect: 'follow' }
	);
	const html = await r.text();

	if (html.includes('Not Logged On') && r.status === 404) {
		throw new Error('Session expired');
	}

	session.token = extractToken(html);

	const $ = cheerio.load(html);
	const classes: ClassInfo[] = [];

	// Store form data for later class selection
	const formData = extractFormData(html, 'classListForm');
	(session as any)._formData = formData;

	$('tr')
		.filter((_, el) => {
			const cls = $(el).attr('class') ?? '';
			return cls.includes('listCell');
		})
		.each((_, row) => {
			const cells = $(row).find('td');
			if (cells.length < 6) return;
			const text = cells.map((__, cell) => $(cell).text().trim()).get();
			const checkbox = $(row).find('input[type="checkbox"][name="selectedOids"]');
			const oid = checkbox.attr('value') ?? '';
			classes.push({
				oid,
				name: text[1],
				term: text[2],
				teacher: text[3],
				room: text[4],
				grade: text[5] || null,
			});
		});

	return classes;
}

export async function selectClass(
	session: MyEdSession,
	classOid: string
): Promise<void> {
	const formData = (session as any)._formData ?? {};
	const body = new URLSearchParams({
		...formData,
		userEvent: '2100',
		userParam: classOid,
	});

	const r = await fetch(`${BASE_URL}/portalClassList.do`, {
		method: 'POST',
		headers: {
			cookie: session.cookies,
			'content-type': 'application/x-www-form-urlencoded',
		},
		body: body.toString(),
		redirect: 'follow',
	});
	const html = await r.text();
	session.token = extractToken(html);
	session.cookies = extractCookies(r, session.cookies);
}

export async function getAssignments(session: MyEdSession): Promise<Assignment[]> {
	const r = await fetch(
		`${BASE_URL}/portalAssignmentList.do?navkey=academics.classes.list.gcd`,
		{ headers: { cookie: session.cookies }, redirect: 'follow' }
	);
	const html = await r.text();
	session.token = extractToken(html);

	const $ = cheerio.load(html);
	const assignments: Assignment[] = [];

	$('tr')
		.filter((_, el) => ($(el).attr('class') ?? '').includes('listCell'))
		.each((_, row) => {
			const cells = $(row).find('td');
			const text = cells.map((__, cell) => $(cell).text().trim()).get();
			if (text.length >= 8) {
				let pct = text[6];
				const score = text[7];
				// Compute percentage from score fraction (e.g. "16.5/18.0" → "92")
				// Handle ASCII slash, fraction slash (⁄), division slash (∕), etc.
				const slashMatch = score?.match(/(\d+(?:\.\d+)?)\s*[\/⁄∕]\s*(\d+(?:\.\d+)?)/);
				if (slashMatch) {
					const num = parseFloat(slashMatch[1]);
					const den = parseFloat(slashMatch[2]);
					if (den > 0 && !isNaN(num) && !isNaN(den)) {
						pct = String(Math.round((num / den) * 100));
					}
				}
				assignments.push({
					name: text[1],
					due: text[3],
					pct,
					score,
					feedback: text.length > 9 ? text[9] : '',
				});
			}
		});

	return assignments;
}

export interface AttendanceRecord {
	date: string;
	code: string;
	reason: string;
}

export async function getAttendance(session: MyEdSession): Promise<AttendanceRecord[]> {
	const r = await fetch(
		`${BASE_URL}/contextList.do?navkey=academics.classes.list.pat`,
		{ headers: { cookie: session.cookies }, redirect: 'follow' }
	);
	const html = await r.text();
	const $ = cheerio.load(html);
	const records: AttendanceRecord[] = [];

	$('tr')
		.filter((_, el) => ($(el).attr('class') ?? '').includes('listCell'))
		.each((_, row) => {
			const cells = $(row).find('td');
			const text = cells.map((__, cell) => $(cell).text().trim()).get();
			// [0]=checkbox, [1]=date, [2]=code, [3..]=reason/other
			if (text.length >= 3) {
				records.push({
					date: text[1] || '',
					code: text[2] || '',
					reason: text.slice(3).filter(Boolean).join(' '),
				});
			}
		});

	return records;
}

export async function getStudentInfo(
	session: MyEdSession
): Promise<Record<string, string>> {
	const r = await fetch(
		`${BASE_URL}/portalStudentDetail.do?navkey=myInfo.details.detail`,
		{ headers: { cookie: session.cookies }, redirect: 'follow' }
	);
	const html = await r.text();
	const $ = cheerio.load(html);
	const info: Record<string, string> = {};

	$('tr').each((_, row) => {
		const tds = $(row).find('td');
		const labelTd = tds.filter((__, td) =>
			($(td).attr('class') ?? '').toLowerCase().includes('label')
		);
		const valueTd = tds.filter((__, td) =>
			($(td).attr('class') ?? '').toLowerCase().includes('value')
		);

		let label = labelTd.first();
		let value = valueTd.first();

		if (!label.length && !value.length && tds.length === 2) {
			label = tds.eq(0);
			value = tds.eq(1);
		}

		const key = label.text().trim().replace(/:$/, '');
		const val = value.text().trim();
		if (key && val) info[key] = val;
	});

	return info;
}

export async function getGroups(session: MyEdSession): Promise<string[][]> {
	const r = await fetch(
		`${BASE_URL}/portalGroupList.do?navkey=extras.groups.list`,
		{ headers: { cookie: session.cookies }, redirect: 'follow' }
	);
	const html = await r.text();
	const $ = cheerio.load(html);
	const groups: string[][] = [];

	$('tr')
		.filter((_, el) => ($(el).attr('class') ?? '').includes('listCell'))
		.each((_, row) => {
			const cells = $(row).find('td');
			const text = cells.map((__, cell) => $(cell).text().trim()).get();
			if (text.length >= 2) groups.push(text);
		});

	return groups;
}

export interface CalendarEvent {
	name: string;
	section: string;
	date: string;
	type: 'assignment' | 'event';
}

export interface CalendarData {
	month: string;
	events: CalendarEvent[];
}

export async function getCalendar(session: MyEdSession): Promise<CalendarData> {
	// Load planner page to establish session context
	const initR = await fetch(`${BASE_URL}/planner.do?navkey=plannerCalendar.plannerView.planner`, {
		headers: { cookie: session.cookies }, redirect: 'follow',
	});
	const initHtml = await initR.text();
	session.token = extractToken(initHtml);

	// Try parsing the full planner page first
	const result = parseCalendarHtml(initHtml);
	if (result.month) return result;

	// If month title missing (full page vs AJAX fragment), navigate prev+next to get AJAX format
	await fetch(`${BASE_URL}/plannerCalendar.do?userEvent=70`, {
		headers: { cookie: session.cookies }, redirect: 'follow',
	});
	const r = await fetch(`${BASE_URL}/plannerCalendar.do?userEvent=60`, {
		headers: { cookie: session.cookies }, redirect: 'follow',
	});
	return parseCalendarHtml(await r.text());
}

export async function navigateCalendarMonth(session: MyEdSession, direction: 'prev' | 'next'): Promise<CalendarData> {
	const userEvent = direction === 'next' ? '60' : '70';
	const r = await fetch(`${BASE_URL}/plannerCalendar.do?userEvent=${userEvent}`, {
		headers: { cookie: session.cookies }, redirect: 'follow',
	});
	const html = await r.text();
	return parseCalendarHtml(html);
}

function parseCalendarHtml(html: string): CalendarData {
	const $ = cheerio.load(html);
	const events: CalendarEvent[] = [];

	const monthTitle = $('.plannerNavigatorTitle').text().trim() || '';

	$('td.plannerDateCell').each((_, cell) => {
		const dateId = $(cell).attr('id') || '';
		const isNonSession = ($(cell).attr('class') || '').includes('plannerNonsession');

		$(cell).find('.plannerAssignment, .compactPlannerEvent').each((__, eventEl) => {
			const name = $(eventEl).find('.plannerEventName').text().trim();
			const section = $(eventEl).find('.plannerEventSection').text().trim();
			const isAssignment = ($(eventEl).attr('class') || '').includes('plannerAssignment');

			if (name) {
				events.push({
					name,
					section,
					date: dateId,
					type: isAssignment ? 'assignment' : 'event',
				});
			}
		});
	});

	return { month: monthTitle, events };
}

export async function getLocker(session: MyEdSession): Promise<string[][]> {
	const r = await fetch(
		`${BASE_URL}/studentLockerList.do?navkey=locker.files.list`,
		{ headers: { cookie: session.cookies }, redirect: 'follow' }
	);
	const html = await r.text();
	const $ = cheerio.load(html);
	const files: string[][] = [];

	$('tr')
		.filter((_, el) => ($(el).attr('class') ?? '').includes('listCell'))
		.each((_, row) => {
			const cells = $(row).find('td');
			const text = cells.map((__, cell) => $(cell).text().trim()).get();
			if (text.length >= 2) files.push(text);
		});

	return files;
}
