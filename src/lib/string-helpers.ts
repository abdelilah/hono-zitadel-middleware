import { createHash, createSign } from 'node:crypto';

export function genRandomString(length: number): string {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
	let randomString = '';
	for (let i = 0; i < length; i++) {
		randomString += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return randomString;
}

export function generateCodeChallenge(verifier: string): string {
	const verifierBuffer = Buffer.from(verifier);
	const hashed = createHash('sha256').update(verifierBuffer).digest();
	return hashed
		.toString('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
}
