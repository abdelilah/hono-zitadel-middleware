import { createMiddleware } from 'hono/factory';
import {
	generateCodeChallenge,
	genRandomString,
} from './lib/string-helpers.js';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
import requireSession from './require-session.js';

type JWTConfig = {
	keyId: string;
	key: string;
	appId: string;
	clientId: string;
};

interface AuthMiddlewareConfig {
	authBaseUrl?: string;
	oauthUrl: string;
	clientId: string;
	jwtConfig: JWTConfig;
	scope?: string;
	successRedirectUrl?: string;
	errorRedirectUrl?: string;
}

function createAuthMiddleware({
	authBaseUrl = '/auth',
	oauthUrl,
	clientId,
	jwtConfig,
	scope = 'openid profile email',
	successRedirectUrl = '/',
	errorRedirectUrl = '/',
}: AuthMiddlewareConfig) {
	return createMiddleware(async (context, next) => {
		const requestUrl = new URL(context.req.url);
		const authCallbackEndpoint = `${authBaseUrl}/callback`;
		const callbackUrl = new URL(authCallbackEndpoint, requestUrl.origin);
		let session = null;

		// Handle auth endpoint
		if (requestUrl.pathname === authBaseUrl) {
			const codeVerifier = genRandomString(128);
			const codeChallenge = generateCodeChallenge(codeVerifier);
			const state = genRandomString(32);

			const params = new URLSearchParams({
				client_id: clientId,
				response_type: 'code',
				redirect_uri: callbackUrl.toString(),
				code_challenge: codeChallenge,
				code_challenge_method: 'S256',
				state,
				scope,
			});

			const authorizeUrl = `${oauthUrl}/oauth/v2/authorize`;
			const redirectTo = `${authorizeUrl}?${params.toString()}`;

			// Save state and code verifier to cookie
			setCookie(context, 'state', state, { httpOnly: true });
			setCookie(context, 'code_verifier', codeVerifier, { httpOnly: true });

			return context.redirect(redirectTo);
		}

		// Handle callback endpoint
		if (requestUrl.pathname === authCallbackEndpoint) {
			const state = getCookie(context, 'state') || '';
			const codeVerifier = getCookie(context, 'code_verifier') || '';
			const code = requestUrl.searchParams.get('code') || '';
			const returnedState = requestUrl.searchParams.get('state') || '';

			if (state !== returnedState) {
				return context.redirect(`${errorRedirectUrl}?error=invalid_state`);
			}

			// Exchange code for token
			const tokenUrl = `${oauthUrl}/oauth/v2/token`;
			const tokenParams = new URLSearchParams({
				client_id: clientId,
				grant_type: 'authorization_code',
				code,
				redirect_uri: callbackUrl.toString(),
				code_verifier: codeVerifier,
			});
			const tokenResponse = await fetch(tokenUrl.toString(), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: tokenParams.toString(),
			}).then((res) => res.json());

			if (tokenResponse.error) {
				return context.redirect(
					`${errorRedirectUrl}?error=${tokenResponse.error}`,
				);
			}

			// Store access_token and id_token in cookie
			const cookieExpiresAt = new Date(
				Date.now() + tokenResponse.expires_in * 1000,
			);

			// Update cookies
			deleteCookie(context, 'state');
			deleteCookie(context, 'code_verifier');
			setCookie(context, 'access_token', tokenResponse.access_token, {
				httpOnly: true,
				expires: cookieExpiresAt,
			});

			// Redirect back to the root
			return context.redirect(successRedirectUrl);
		}

		const accessToken = getCookie(context, 'access_token');

		// Handle logout endpoint
		const logoutUrl = new URL(`${authBaseUrl}/logout`, requestUrl.origin);
		if (requestUrl.pathname === logoutUrl.pathname) {
			deleteCookie(context, 'access_token');
			const revokeUrl = `${oauthUrl}/oauth/v2/revoke`;
			await fetch(revokeUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					client_id: clientId,
					token: accessToken,
				} as any).toString(),
			});

			return context.redirect(successRedirectUrl);
		}

		if (accessToken) {
			const introspectUrl = `${oauthUrl}/oauth/v2/introspect`;
			const now = Math.floor(Date.now() / 1000);

			// Verify the token and get the user info
			const jwtHeaders = {
				alg: 'RS256',
				kid: jwtConfig.keyId,
			};
			const jwtPayload = {
				iss: jwtConfig.clientId,
				sub: jwtConfig.clientId,
				aud: oauthUrl,
				exp: now + 60 * 60,
				iat: now,
			};
			const jwtToken = jwt.sign(jwtPayload, jwtConfig.key, {
				header: jwtHeaders,
			});

			const reqData = {
				client_assertion_type:
					'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
				client_assertion: jwtToken,
				token: accessToken,
			};

			const introspectResult = await fetch(introspectUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams(reqData as any).toString(),
			}).then((res) => res.json());

			if (introspectResult.active) {
				const userFields = [
					'username',
					'name',
					'family_name',
					'given_name',
					'preferred_username',
					'email',
					'email_verified',
					'updated_at',
				];

				const user = userFields.reduce((acc, field) => {
					acc[field] = introspectResult[field];
					return acc;
				}, {} as any);

				user!.id = introspectResult.sub;

				session = {
					user: {
						id: introspectResult.sub,
						...user,
					},
					expires_at: introspectResult.exp,
					access_token: accessToken,
					info: introspectResult,
				};
			} else {
				// Token is invalid, unset the cookie
				deleteCookie(context, 'access_token');
			}
		}

		context.set('session', session);

		await next();
	});
}

export { createAuthMiddleware, requireSession };

export default createAuthMiddleware;
