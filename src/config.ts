import type { UberConfig } from './types.js';

const DEFAULT_REDIRECT_URI = 'http://localhost:3000/callback';
const DEFAULT_API_BASE_URL = 'https://api.uber.com';
const DEFAULT_AUTH_BASE_URL = 'https://auth.uber.com';

export function readUberConfig(env: NodeJS.ProcessEnv = process.env): UberConfig {
  return {
    clientId: env.UBER_CLIENT_ID ?? '',
    clientSecret: env.UBER_CLIENT_SECRET ?? '',
    serverToken: env.UBER_SERVER_TOKEN,
    redirectUri: env.UBER_REDIRECT_URI ?? DEFAULT_REDIRECT_URI,
    apiBaseUrl: env.UBER_API_BASE_URL ?? DEFAULT_API_BASE_URL,
    authBaseUrl: env.UBER_AUTH_BASE_URL ?? DEFAULT_AUTH_BASE_URL,
    environment: env.UBER_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
  };
}
