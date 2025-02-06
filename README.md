# hono-zitadel-middleware

A minimal authentication middleware for [Hono](https://hono.dev/) to authenticate users with [Zitadel](https://zitadel.com/) using the OAuth2 flow.

## Installation

```bash
npm install hono-zitadel-middleware
```

## Prerequisites

Before you can use this middleware, you need to create a Zitadel project and configure the OAuth2 client credentials. After creating a project, you need to create two apps:

- A web app for the frontend mainly used for the OAuth2 authorization code flow. When asked to select a type please select `PKCE` as it it the most secure and recommended way to authenticate users. Once created take note of the `Client ID`.
- A `API` app for the backend that we'll be used to verify the access token on requests. After selecting `API` as the app type next we need to select the `JWT` as the authentication method which is the recommended way by Zitadel. Once created you'll get a JSON file that contains the private key and other app related information.

## Usage

```typescript
import { createAuthMiddleware, requireSession } from 'hono-zitadel-middleware';

const app = new Hono();

// Create the middleware
const authMiddleware = createAuthMiddleware({
	oauthUrl: 'https://your-zitadel-instance-url',
	clientId: 'your-client-id',
	jwtConfig: JSON.parse('your-jwt-config'),
});

// Use the middleware, this will now handle the authentication flow by visiting /auth and parse + validate access tokens on requests
app.use(authMiddleware);

// Use the requireSession middleware cab be used to protect routes that require a valid session
app.get('/protected', requireSession(), (c) => {
	// Session details are available on the context object
	const session = c.get('session');

	return c.text('Hello World');
});
```

## Middleware options

### `createAuthMiddleware`

| Option             | Required | Default                         | Description                                                                                        |
| ------------------ | -------- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `oauthUrl`         | Yes      | -                               | The URL to your Zitadel instance                                                                   |
| `clientId`         | Yes      | -                               | The client ID of the OAuth2 client                                                                 |
| `jwtConfig`        | Yes      | -                               | The JWT configuration object from the Zitadel API                                                  |
| `authBaseUrl`      | No       | `/auth`                         | The base URL for the authentication flow                                                           |
| `scopes`           | No       | `['openid', 'profile', 'email]` | The scopes to request from the OAuth2 server                                                       |
| `successRedirect`  | No       | `/`                             | The URL to redirect to after a successful login                                                    |
| `errorRedirectUrl` | No       | `/`                             | The URL to redirect to after an error. A `error` query parameter will be added with the error code |

### `requireSession`

| Option       | Required | Default | Description                                             |
| ------------ | -------- | ------- | ------------------------------------------------------- |
| `redirectTo` | No       | `/auth` | The URL to redirect to if the user is not authenticated |
