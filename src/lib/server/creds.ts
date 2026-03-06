import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// In production, set CREDS_KEY env var (32-byte hex). Falls back to a random key (resets on restart).
const KEY = process.env.CREDS_KEY
	? Buffer.from(process.env.CREDS_KEY, 'hex')
	: randomBytes(32);

export function encryptCreds(username: string, password: string): string {
	const iv = randomBytes(16);
	const cipher = createCipheriv('aes-256-gcm', KEY, iv);
	const payload = JSON.stringify({ username, password });
	const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptCreds(data: string): { username: string; password: string } | null {
	try {
		const buf = Buffer.from(data, 'base64');
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
