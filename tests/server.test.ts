import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createUberServer } from '../src/index.js';
import { UberClient } from '../src/uber-client.js';
import type { UberConfig } from '../src/types.js';

const testConfig: UberConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'http://localhost:3000/callback',
  apiBaseUrl: 'https://api.uber.test',
  authBaseUrl: 'https://auth.uber.test',
  environment: 'sandbox',
};

const expectedToolNames = [
  'uber_get_auth_url',
  'uber_set_access_token',
  'uber_get_price_estimates',
  'uber_request_ride',
  'uber_get_ride_status',
  'uber_cancel_ride',
];

interface TestSession {
  client: Client;
  server: ReturnType<typeof createUberServer>;
}

async function createSession(): Promise<TestSession> {
  const server = createUberServer(new UberClient(testConfig));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'mcp-uber-test', version: '0.0.0' });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { client, server };
}

function firstText(content: unknown): string {
  const blocks = content as Array<{ type: string; text?: string }>;
  return blocks[0]?.text ?? '';
}

describe('mcp-uber server', () => {
  let session: TestSession | undefined;

  afterEach(async () => {
    await session?.client.close();
    await session?.server.close();
    session = undefined;
  });

  it('lists all Uber tools with their input schemas', async () => {
    session = await createSession();

    const { tools } = await session.client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(expectedToolNames);

    const authTool = tools.find((tool) => tool.name === 'uber_get_auth_url');
    expect(authTool?.inputSchema).toEqual({
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'Unique identifier for the user' },
      },
      required: ['userId'],
    });

    const rideTool = tools.find((tool) => tool.name === 'uber_request_ride');
    expect(rideTool?.inputSchema.required).toEqual([
      'userId',
      'productId',
      'startLatitude',
      'startLongitude',
      'endLatitude',
      'endLongitude',
    ]);
    expect(rideTool?.inputSchema.properties?.fareId).toEqual({
      type: 'string',
      description: 'Fare ID from price estimate',
    });
  });

  it('returns the Uber authorization URL for a user', async () => {
    session = await createSession();

    const result = await session.client.callTool({
      name: 'uber_get_auth_url',
      arguments: { userId: 'user-1' },
    });
    const text = firstText(result.content);

    expect(text).toContain('https://auth.uber.test/oauth/v2/authorize');
    expect(text).toContain('client_id=test-client-id');
    expect(text).toContain('state=user-1');
  });

  it('stores an access token provided by the user', async () => {
    session = await createSession();

    const result = await session.client.callTool({
      name: 'uber_set_access_token',
      arguments: { userId: 'user-1', accessToken: 'token-123' },
    });

    expect(firstText(result.content)).toBe('Access token set successfully');
  });

  it('reports an error when the user is not authenticated', async () => {
    session = await createSession();

    const result = await session.client.callTool({
      name: 'uber_get_price_estimates',
      arguments: {
        userId: 'anonymous',
        startLatitude: -23.5,
        startLongitude: -46.6,
        endLatitude: -23.6,
        endLongitude: -46.7,
      },
    });

    expect(firstText(result.content)).toContain('User not authenticated');
  });

  it('reports an error for unknown tools', async () => {
    session = await createSession();

    const result = await session.client.callTool({ name: 'uber_nope', arguments: {} });

    expect(firstText(result.content)).toBe('Error: Unknown tool: uber_nope');
  });

  it('reports an error when required arguments are missing', async () => {
    session = await createSession();

    const result = await session.client.callTool({ name: 'uber_get_auth_url', arguments: {} });

    expect(firstText(result.content)).toMatch(/^Error: /);
  });
});
