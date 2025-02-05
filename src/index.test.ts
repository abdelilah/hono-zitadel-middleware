import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import createAuthMiddleware from './index.js';
import requireSession from './require-session.js';

const SERVER_PORT = 3303;
const OAUTH_PORT = 3304;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const AUTH_CONFIG = {
	oauthUrl: `http://localhost:${OAUTH_PORT}`,
	clientId: 'client-id',
	jwtConfig: {
		keyId: 'key-id',
		key: 'private-key',
		appId: 'app-id',
		clientId: 'client-id',
	},
};

// Setup test server
const app = new Hono();
app.use(createAuthMiddleware(AUTH_CONFIG));
app.get('/', (c) => {
	return c.text('Hello World');
});
app.get('/protected', requireSession(), (c) => {
	return c.text('Super secret stuff');
});

// Mock OAuth server
const oauthApp = new Hono();
oauthApp.get('/oauth/v2/authorize', (c) => {
	return c.redirect('/auth');
});
serve({
	fetch: oauthApp.fetch,
	port: OAUTH_PORT,
});

beforeAll(() => {
	return new Promise((resolve) => {
		const server = serve({
			fetch: app.fetch,
			port: SERVER_PORT,
		});

		server.on('listening', () => {
			resolve(true);
		});
	});
});

it('Home page shows hello world text', async () => {
	const response = await fetch(SERVER_URL);
	const text = await response.text();
	expect(text).toBe('Hello World');
});

it('/protected must redirect to /auth', async () => {
	const response = await fetch(`${SERVER_URL}/protected`, {
		redirect: 'manual',
	});

	expect(response.status).toBe(302);
	expect(response.headers.get('location')).toBe('/auth');
});

it('/auth must set state and code verifier cookies and redirect to auth URL', async () => {
	const response = await fetch(`${SERVER_URL}/auth`, {
		redirect: 'manual',
	});
	const headers = response.headers;
	const redirectUrl = new URL(headers.get('location')!);

	expect(response.status).toBe(302);
	expect(redirectUrl.origin).toBe(AUTH_CONFIG.oauthUrl);
	expect(redirectUrl.pathname).toBe('/oauth/v2/authorize');
	expect(headers.get('set-cookie')).toContain('state=');
	expect(headers.get('set-cookie')).toContain('code_verifier=');
});
