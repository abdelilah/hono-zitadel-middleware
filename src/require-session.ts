import { createMiddleware } from 'hono/factory';

interface RequireSessionConfig {
	redirectTo?: string;
}

export function requireSession(config?: RequireSessionConfig) {
	const { redirectTo = '/auth' } = config || {};

	return createMiddleware(async (context, next) => {
		const session = context.get('session');

		if (!session) {
			return context.redirect(redirectTo);
		}

		await next();
	});
}

export default requireSession;
