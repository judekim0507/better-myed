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

export interface TermMark {
	category: string;
	terms: Record<string, string>;
}

export interface ClassDetail {
	termMarks: TermMark[];
	finalGrade: string;
}

export async function getClassDetail(session: MyEdSession): Promise<ClassDetail> {
	const r = await fetch(
		`${BASE_URL}/portalClassDetail.do?navkey=academics.classes.list.detail`,
		{ headers: { cookie: session.cookies }, redirect: 'follow' }
	);
	const html = await r.text();
	const $ = cheerio.load(html);

	// Parse Average Summary grid (#dataGridRight)
	const termMarks: TermMark[] = [];
	const rightGrid = $('#dataGridRight table');
	if (rightGrid.length) {
		// Get column headers (term names)
		const headers: string[] = [];
		rightGrid.find('tr.listHeader th').each((_, th) => {
			const text = $(th).text().trim();
			if (text && text !== 'Category') headers.push(text);
		});

		// Rows alternate: category name (with weights) → "Avg" (with actual grades)
		// Pair them: use category name + Avg values. Keep "Last posted grade" as-is.
		let pendingCategory = '';
		rightGrid.find('tr.listCell').each((_, row) => {
			const cells = $(row).find('td');
			const category = cells.first().text().trim();
			const terms: Record<string, string> = {};
			const dataCells = cells.slice(cells.length - headers.length);
			dataCells.each((i, cell) => {
				const val = $(cell).text().trim();
				if (headers[i] && val) terms[headers[i]] = val;
			});

			if (category === 'Avg') {
				// This is the grade row — use the pending category name
				const label = pendingCategory || 'Average';
				if (Object.keys(terms).length) termMarks.push({ category: label, terms });
				pendingCategory = '';
			} else if (category === 'Last posted grade') {
				if (Object.keys(terms).length) termMarks.push({ category, terms });
			} else {
				// Category name row (weights) — remember name, skip the weight values
				pendingCategory = category;
			}
		});
	}

	// Parse Final grade
	const finalGrade = $('td.detailProperty:contains("Final")').next('td.detailValue').text().trim();

	return { termMarks, finalGrade };
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
				const rawPct = text[6];
				let score = text[7];
				let pct = rawPct;
				// text[6] may contain a fraction like "16.5 / 18.0" — parse and compute %
				const fracMatch = rawPct?.match(/(\d+(?:\.\d+)?)\s*[\/⁄∕]\s*(\d+(?:\.\d+)?)/);
				if (fracMatch) {
					const num = parseFloat(fracMatch[1]);
					const den = parseFloat(fracMatch[2]);
					if (den > 0 && !isNaN(num) && !isNaN(den)) {
						pct = String(Math.round((num / den) * 100));
						score = `${num} / ${den}`;
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
		`${BASE_URL}/studentAttendanceList.do?navkey=myInfo.att.list`,
		{ headers: { cookie: session.cookies }, redirect: 'follow' }
	);
	const html = await r.text();

	// Verify we got the attendance page, not a redirect/login
	if (!html.includes('studentAttendanceList') && !html.includes('attCodeView')) {
		throw new Error('Did not receive attendance page');
	}

	const $ = cheerio.load(html);
	const records: AttendanceRecord[] = [];

	$('tr.listCell, tr[class*="listCell"]').each((_, row) => {
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

export interface PublishedReport {
	name: string;
	size: string;
	date: string;
	creator: string;
	description: string;
	oid: string;
}

export async function getPublishedReports(session: MyEdSession): Promise<PublishedReport[]> {
	// First hit home.do to establish context
	await fetch(`${BASE_URL}/home.do`, {
		headers: { cookie: session.cookies },
		redirect: 'follow',
	});

	// Then fetch the published reports widget
	const r = await fetch(
		`${BASE_URL}/publishedReportsWidget.do?groupPageWidgetOid=GPW000000sgrwa&widgetId=publishedReports_8`,
		{ headers: { cookie: session.cookies }, redirect: 'follow' }
	);
	const html = await r.text();
	const $ = cheerio.load(html);
	const reports: PublishedReport[] = [];

	// Each report is a <tr> inside #publishedList with .portletListCell cells
	// Structure: [filename cell (has nested table with onclick containing fileDownload.do URL)] [date] [creator] [description]
	$('#publishedList > tr:has(.portletListCell), #publishedList > tbody > tr:has(.portletListCell)').each((_, row) => {
		const cells = $(row).children('td.portletListCell');
		if (cells.length < 4) return;

		// Filename cell contains a nested table with onclick handler holding the download URL
		const filenameCell = cells.eq(0);
		const onclickEl = filenameCell.find('[onclick]').first();
		const onclick = onclickEl.attr('onclick') ?? '';
		const urlMatch = onclick.match(/['"]([^'"]*fileDownload\.do[^'"]*)['"]/);
		if (!urlMatch) return;

		const downloadPath = urlMatch[1];
		const oidMatch = downloadPath.match(/oid=([^&]+)/);
		if (!oidMatch) return;

		// Name is text content of the pointer cell (skip the image)
		const name = filenameCell.find('td.pointer').first().text().trim();
		const size = filenameCell.find('.fileDownloadInfo').text().trim();
		const date = cells.eq(1).text().trim();
		const creator = cells.eq(2).text().trim();
		const description = cells.eq(3).text().trim();

		if (name) {
			reports.push({ name, size, date, creator, description, oid: oidMatch[1] });
		}
	});

	return reports;
}

export async function getReportPdf(session: MyEdSession, reportOid: string): Promise<Response> {
	// Re-fetch the widget to get a fresh download URL with valid auth token
	await fetch(`${BASE_URL}/home.do`, {
		headers: { cookie: session.cookies },
		redirect: 'follow',
	});
	const widgetRes = await fetch(
		`${BASE_URL}/publishedReportsWidget.do?groupPageWidgetOid=GPW000000sgrwa&widgetId=publishedReports_8`,
		{ headers: { cookie: session.cookies }, redirect: 'follow' }
	);
	const html = await widgetRes.text();
	const $ = cheerio.load(html);

	// Find fresh download URL matching the OID
	let freshUrl = '';
	$('#publishedList > tr:has(.portletListCell), #publishedList > tbody > tr:has(.portletListCell)').each((_, row) => {
		if (freshUrl) return;
		const onclick = $(row).find('[onclick]').first().attr('onclick') ?? '';
		const urlMatch = onclick.match(/['"]([^'"]*fileDownload\.do[^'"]*)['"]/);
		if (urlMatch && urlMatch[1].includes(reportOid)) {
			freshUrl = `${BASE_URL}/${urlMatch[1]}`;
		}
	});

	if (!freshUrl) {
		throw new Error('Could not find fresh download URL for report');
	}

	// First fetch returns HTML with a window.open(rewriteUrl('...temp/file.pdf'))
	const dlRes = await fetch(freshUrl, {
		headers: { cookie: session.cookies },
		redirect: 'follow',
	});
	const dlHtml = await dlRes.text();

	// Extract the actual PDF URL from the JavaScript
	const pdfMatch = dlHtml.match(/rewriteUrl\(['"]([^'"]+)['"]\)/);
	if (!pdfMatch) {
		throw new Error('Could not find PDF URL in download response');
	}

	return fetch(pdfMatch[1], {
		headers: { cookie: session.cookies },
		redirect: 'follow',
	});
}


export interface TranscriptEntry {
	year: string;
	grade: string;
	course: string;
	finalGrade: string;
	credit: string;
}

export async function getTranscript(session: MyEdSession): Promise<TranscriptEntry[]> {
	const r = await fetch(
		`${BASE_URL}/transcriptList.do?navkey=myInfo.trn.list`,
		{ headers: { cookie: session.cookies }, redirect: 'follow' }
	);
	const html = await r.text();
	const $ = cheerio.load(html);
	const entries: TranscriptEntry[] = [];

	$('tr')
		.filter((_, el) => ($(el).attr('class') ?? '').includes('listCell'))
		.each((_, row) => {
			const cells = $(row).find('td');
			const text = cells.map((__, cell) => $(cell).text().trim()).get();
			// [0]=checkbox, [1]=year, [2]=grade level, [3]=course, [4]=final grade, [5]=credit
			if (text.length >= 6) {
				entries.push({
					year: text[1],
					grade: text[2],
					course: text[3],
					finalGrade: text[4],
					credit: text[5],
				});
			}
		});

	return entries;
}

export interface GradRequirement {
	code: string;
	description: string;
	required: string;
	completed: string;
	status: string;
}

export interface GradSummary {
	program: string;
	requiredTotal: string;
	completedTotal: string;
	requirements: GradRequirement[];
}

export async function getGraduationSummary(session: MyEdSession): Promise<GradSummary> {
	const r = await fetch(
		`${BASE_URL}/graduationSummary.do?includeProjection=false&navkey=myInfo.gradSummary.graduation`,
		{ headers: { cookie: session.cookies }, redirect: 'follow' }
	);
	const html = await r.text();
	const $ = cheerio.load(html);

	// Program name from the select dropdown, cleaned up
	const rawProgram = $('#selectedProgramStudiesOid option[selected]').text().trim() || '';
	// "2023 - EN English Grad Program" → "English Graduation Program"
	const program = rawProgram
		.replace(/^\d{4}\s*-\s*/, '')       // remove year prefix
		.replace(/^[A-Z]{2}\s+/, '')        // remove 2-letter code prefix
		.replace(/\bGrad\b/gi, 'Graduation');

	// Totals from the header area
	const headerText = html.match(/Required unit[^:]*:\s*([\d.]+)/)?.[1] ?? '';
	const completedText = html.match(/Unit completed[^:]*:\s*([\d.]+)/)?.[1] ?? '';

	// Parse top-level requirement rows from the requirementSummaryTable
	const requirements: GradRequirement[] = [];
	$('table.requirementSummaryTable tr.listCell').each((_, row) => {
		const $row = $(row);
		// Skip totalRowBorder rows
		if (($row.attr('class') ?? '').includes('totalRowBorder')) return;

		const cells = $row.children('td, th');
		// First meaningful td after expand icon contains the code
		const codeTd = cells.filter((__, cell) => {
			const text = $(cell).text().trim();
			return !!(text && !$(cell).find('img').length && $(cell).attr('width') !== '15' && $(cell).attr('width') !== '1');
		});

		if (codeTd.length < 2) return;

		const codeText = codeTd.eq(0).text().trim().split('\n')[0].trim();
		// Description from anchor in the descriptionCell
		const descAnchor = $row.find('.descriptionCell a').first();
		const description = descAnchor.text().trim() || codeTd.eq(1).text().trim();

		// Required, completed, and status are in later tds
		const allTdTexts = cells.map((__, cell) => $(cell).text().trim()).get();
		// Find numeric values for required and completed
		let required = '';
		let completed = '';
		let status = '';

		// Look for the pattern: number cells followed by "X% completed"
		for (let i = 0; i < allTdTexts.length; i++) {
			const t = allTdTexts[i];
			if (/^\d+(\.\d+)?$/.test(t) && !required) {
				required = t;
			} else if (/^\d+(\.\d+)?$/.test(t) && required && !completed) {
				completed = t;
			}
			const pctMatch = t.match(/(\d+)\s*%\s*completed/);
			if (pctMatch) {
				status = pctMatch[1] + '%';
			}
		}

		if (codeText && description) {
			requirements.push({ code: codeText, description, required, completed, status });
		}
	});

	return {
		program,
		requiredTotal: headerText,
		completedTotal: completedText,
		requirements,
	};
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
