import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { UberClient } from '../src/uber-client.js';
import type { UberConfig, UberToken } from '../src/types.js';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
    post: vi.fn(),
  },
}));

const axiosMock = axios as unknown as { create: Mock; post: Mock };

const testConfig: UberConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'http://localhost:3000/callback',
  apiBaseUrl: 'https://api.uber.test',
  authBaseUrl: 'https://auth.uber.test',
  environment: 'sandbox',
};

interface MockApi {
  get: Mock;
  post: Mock;
  delete: Mock;
  defaults: { headers: { common: Record<string, string> } };
}

function createMockApi(): MockApi {
  return {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  };
}

describe('UberClient', () => {
  let api: MockApi;
  let client: UberClient;

  beforeEach(() => {
    api = createMockApi();
    axiosMock.create.mockReturnValue(api as unknown as AxiosInstance);
    client = new UberClient(testConfig);
  });

  describe('getAuthorizationUrl', () => {
    it('builds the OAuth authorize URL with the configured client and scopes', async () => {
      const url = new URL(await client.getAuthorizationUrl('user-42'));

      expect(url.origin + url.pathname).toBe('https://auth.uber.test/oauth/v2/authorize');
      expect(url.searchParams.get('client_id')).toBe(testConfig.clientId);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('redirect_uri')).toBe(testConfig.redirectUri);
      expect(url.searchParams.get('scope')).toBe('profile request ride_request');
      expect(url.searchParams.get('state')).toBe('user-42');
    });
  });

  describe('setAccessToken', () => {
    it('sets the bearer token on the API client', () => {
      client.setAccessToken('token-abc');

      expect(api.defaults.headers.common['Authorization']).toBe('Bearer token-abc');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('posts the code and stores the returned token', async () => {
      const token: UberToken = {
        access_token: 'token-123',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'refresh-1',
        scope: 'profile',
      };
      axiosMock.post.mockResolvedValue({ data: token });

      await expect(client.exchangeCodeForToken('auth-code')).resolves.toEqual(token);

      expect(axiosMock.post).toHaveBeenCalledWith('https://auth.uber.test/oauth/v2/token', {
        client_id: testConfig.clientId,
        client_secret: testConfig.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: testConfig.redirectUri,
        code: 'auth-code',
      });
      expect(api.defaults.headers.common['Authorization']).toBe('Bearer token-123');
    });
  });

  describe('getPriceEstimates', () => {
    it('requests price estimates for the coordinates and returns the prices', async () => {
      const prices = [
        {
          product_id: 'uberx',
          currency_code: 'BRL',
          display_name: 'UberX',
          estimate: 'R$ 20-25',
          low_estimate: 20,
          high_estimate: 25,
          distance: 5,
          duration: 900,
          surge_multiplier: 1,
        },
      ];
      api.get.mockResolvedValue({ data: { prices } });

      await expect(client.getPriceEstimates(1, 2, 3, 4)).resolves.toEqual(prices);

      expect(api.get).toHaveBeenCalledWith('/v1.2/estimates/price', {
        params: {
          start_latitude: 1,
          start_longitude: 2,
          end_latitude: 3,
          end_longitude: 4,
        },
      });
    });
  });

  describe('requestRide', () => {
    it('posts a ride request with the coordinates', async () => {
      const ride = { request_id: 'req-1', status: 'processing' };
      api.post.mockResolvedValue({ data: ride });

      await expect(client.requestRide('product-1', 1, 2, 3, 4)).resolves.toEqual(ride);

      expect(api.post).toHaveBeenCalledWith('/v1.2/requests', {
        product_id: 'product-1',
        start_latitude: 1,
        start_longitude: 2,
        end_latitude: 3,
        end_longitude: 4,
      });
    });

    it('includes the fare id when provided', async () => {
      api.post.mockResolvedValue({ data: {} });

      await client.requestRide('product-1', 1, 2, 3, 4, 'fare-9');

      expect(api.post).toHaveBeenCalledWith('/v1.2/requests', {
        product_id: 'product-1',
        start_latitude: 1,
        start_longitude: 2,
        end_latitude: 3,
        end_longitude: 4,
        fare_id: 'fare-9',
      });
    });
  });

  describe('getRideStatus', () => {
    it('fetches the ride request by id', async () => {
      const ride = { request_id: 'req-1', status: 'accepted' };
      api.get.mockResolvedValue({ data: ride });

      await expect(client.getRideStatus('req-1')).resolves.toEqual(ride);

      expect(api.get).toHaveBeenCalledWith('/v1.2/requests/req-1');
    });
  });

  describe('cancelRide', () => {
    it('deletes the ride request by id', async () => {
      api.delete.mockResolvedValue({ data: {} });

      await client.cancelRide('req-1');

      expect(api.delete).toHaveBeenCalledWith('/v1.2/requests/req-1');
    });
  });

  describe('getProducts', () => {
    it('fetches products for the coordinates and returns the list', async () => {
      const products = [{ product_id: 'uberx', display_name: 'UberX' }];
      api.get.mockResolvedValue({ data: { products } });

      await expect(client.getProducts(1, 2)).resolves.toEqual(products);

      expect(api.get).toHaveBeenCalledWith('/v1.2/products', {
        params: { latitude: 1, longitude: 2 },
      });
    });
  });

  describe('error handling', () => {
    it('propagates API errors', async () => {
      api.get.mockRejectedValue(new Error('Request failed with status code 401'));

      await expect(client.getPriceEstimates(1, 2, 3, 4)).rejects.toThrow('401');
    });
  });
});
