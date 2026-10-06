import { describe, expect, it } from 'vitest';
import { readUberConfig } from '../src/config.js';

describe('readUberConfig', () => {
  it('falls back to sandbox defaults when environment variables are missing', () => {
    expect(readUberConfig({})).toEqual({
      clientId: '',
      clientSecret: '',
      serverToken: undefined,
      redirectUri: 'http://localhost:3000/callback',
      apiBaseUrl: 'https://api.uber.com',
      authBaseUrl: 'https://auth.uber.com',
      environment: 'sandbox',
    });
  });

  it('reads credentials, urls and environment from the environment', () => {
    const config = readUberConfig({
      UBER_CLIENT_ID: 'client-id',
      UBER_CLIENT_SECRET: 'client-secret',
      UBER_SERVER_TOKEN: 'server-token',
      UBER_REDIRECT_URI: 'http://localhost:4000/callback',
      UBER_API_BASE_URL: 'https://api.uber.test',
      UBER_AUTH_BASE_URL: 'https://auth.uber.test',
      UBER_ENVIRONMENT: 'production',
    });

    expect(config).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      serverToken: 'server-token',
      redirectUri: 'http://localhost:4000/callback',
      apiBaseUrl: 'https://api.uber.test',
      authBaseUrl: 'https://auth.uber.test',
      environment: 'production',
    });
  });

  it('treats unknown environment values as sandbox', () => {
    expect(readUberConfig({ UBER_ENVIRONMENT: 'PRODUCTION' }).environment).toBe('sandbox');
    expect(readUberConfig({ UBER_ENVIRONMENT: '' }).environment).toBe('sandbox');
  });
});
