# BETTER-MYED

A faster, cleaner interface for [MyEducation BC](https://myeducation.gov.bc.ca). View your grades, assignments, attendance, and schedule — without using MyEd. 

## Why this exists

The BC government spent **$95.4 million** on MyEducation BC (Follett Aspen). What they shipped is (probably more than) a decade-old Java Struts app with server-rendered HTML tables, no mobile support, and a UI that looks like it was last updated when Internet Explorer 6 was the standard. It barely functions on desktop — on mobile, it's completely unusable, as it is not responsive.

$95 million (for reference, a national app, ArriveCAN, was 60 million dollars).

BETTER-MYED reverse-engineers the Aspen servlet and wraps it in an interface that actually works.

## Features

- **Responsive** — works on mobile, tablet, and desktop
- **Fast** — server-side proxying, no Playwright, no headless browsers
- **Grades & assignments** — per-class breakdown with color-coded percentages
- **Attendance** — per-class attendance records
- **Student profile, groups, calendar, locker** — everything MyEd does, but usable
- **Persistent sessions** — optional "Remember me" with encrypted credential storage and automatic re-login

## Tech stack

- **SvelteKit** + **Svelte 5** (runes)
- **Tailwind CSS v4**
- **Bun** runtime
- **Cheerio** for HTML parsing
- No database — sessions in httpOnly cookies, credentials encrypted with AES-256-GCM

## Setup

```bash
bun install
bun run dev
```

For production, set `CREDS_KEY` (32-byte hex) so encryption persists across restarts:

```bash
export CREDS_KEY=$(openssl rand -hex 32)
bun run build
bun run preview
```

## How it works

1. Credentials hit MyEd's REST API (`/app/rest/auth`) → JWT
2. JWT exchanged for a Struts session via `/app/rest/aspen/sso`
3. SvelteKit API routes proxy all requests server-side, parse HTML with Cheerio, return JSON
4. Frontend never talks to MyEd directly — no CORS issues

## Disclaimer

Not affiliated with the BC Ministry of Education, Follett, or MyEducation BC. This is an independent wrapper that uses your own credentials to access your own data. Credentials are encrypted at rest and never stored in plaintext. Pls dont block this, Aspen (u may use the code tho lol). 

## License

AGPL-3.0
