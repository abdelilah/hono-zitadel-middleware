import { createMiddleware } from 'hono/factory';

interface RequireSessionConfig {
	redirectTo?: string;
}

export function requireSession(config?: RequireSessionConfig) {
	const { redirectTo } = config || {};

	return createMiddleware(async (context, next) => {
		const session = context.get('session');

		if (!session) {
			if (redirectTo) {
				return context.redirect(redirectTo);
			}
			
			return context.text('Unauthorized', { status: 401 });
		}

		await next();
	});
}

export default requireSession;
