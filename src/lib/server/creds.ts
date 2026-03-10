import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const CREDS_KEY_HEX = process.env.CREDS_KEY;
if (!CREDS_KEY_HEX && process.env.NODE_ENV === 'production') {
	console.error('FATAL: CREDS_KEY not set. Remember Me is disabled in production.');
}

const KEY = CREDS_KEY_HEX
	? Buffer.from(CREDS_KEY_HEX, 'hex')
	: null;

export function encryptCreds(username: string, password: string): string {
	if (!KEY) throw new Error('CREDS_KEY not configured');
	const iv = randomBytes(16);
	const cipher = createCipheriv('aes-256-gcm', KEY, iv);
	const payload = JSON.stringify({ username, password });
	const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptCreds(data: string): { username: string; password: string } | null {
	if (!KEY) return null;
	try {
		const buf = Buffer.from(data, 'base64');
		if (buf.length < 33) return null;
		const iv = buf.subarray(0, 16);
		const tag = buf.subarray(16, 32);
		const encrypted = buf.subarray(32);
		const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
		decipher.setAuthTag(tag);
		const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
		return JSON.parse(decrypted.toString('utf8'));
	} catch {
		return null;
	}
}
