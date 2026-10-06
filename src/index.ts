#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { UberClient } from './uber-client.js';
import { UberConfig } from './types.js';

// Load environment variables
dotenv.config();

// Define schemas for tool inputs
const AuthorizeSchema = z.object({
  userId: z.string().describe('Unique identifier for the user'),
});

const SetTokenSchema = z.object({
  userId: z.string().describe('Unique identifier for the user'),
  accessToken: z.string().describe('Uber access token for the user'),
});

const PriceEstimateSchema = z.object({
  userId: z.string().describe('Unique identifier for the user'),
  startLatitude: z.number().describe('Starting location latitude'),
  startLongitude: z.number().describe('Starting location longitude'),
  endLatitude: z.number().describe('Destination latitude'),
  endLongitude: z.number().describe('Destination longitude'),
});

const RequestRideSchema = z.object({
  userId: z.string().describe('Unique identifier for the user'),
  productId: z.string().describe('Uber product ID (from price estimates)'),
  startLatitude: z.number().describe('Starting location latitude'),
  startLongitude: z.number().describe('Starting location longitude'),
  endLatitude: z.number().describe('Destination latitude'),
  endLongitude: z.number().describe('Destination longitude'),
  fareId: z.string().optional().describe('Fare ID from price estimate'),
});

const RideStatusSchema = z.object({
  userId: z.string().describe('Unique identifier for the user'),
  requestId: z.string().describe('Ride request ID'),
});

const CancelRideSchema = z.object({
  userId: z.string().describe('Unique identifier for the user'),
  requestId: z.string().describe('Ride request ID to cancel'),
});

interface JsonSchemaProperty {
  type: 'string' | 'number';
  description?: string;
}

// Convert Zod schemas to JSON Schema format
const zodToJsonSchema = (schema: z.ZodObject<z.ZodRawShape>) => {
  const shape = schema.shape;
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as z.ZodTypeAny;
    const isOptional = zodType instanceof z.ZodOptional;
    const baseType = isOptional ? zodType.unwrap() : zodType;

    if (!isOptional) {
      required.push(key);
    }

    if (baseType instanceof z.ZodString) {
      properties[key] = { type: 'string' };
    } else if (baseType instanceof z.ZodNumber) {
      properties[key] = { type: 'number' };
    }

    // Add description if available
    const description = zodType._def.description;
    if (description && properties[key]) {
      properties[key].description = description;
    }
  }

  return {
    type: 'object' as const,
    properties,
    required,
  };
};

// Define available tools
const TOOLS: Tool[] = [
  {
    name: 'uber_get_auth_url',
    description: 'Get the Uber authorization URL for user to authenticate',
    inputSchema: zodToJsonSchema(AuthorizeSchema),
  },
  {
    name: 'uber_set_access_token',
    description: 'Set the access token for a user after OAuth callback',
    inputSchema: zodToJsonSchema(SetTokenSchema),
  },
  {
    name: 'uber_get_price_estimates',
    description: 'Get price estimates for a ride between two locations',
    inputSchema: zodToJsonSchema(PriceEstimateSchema),
  },
  {
    name: 'uber_request_ride',
    description: 'Request an Uber ride',
    inputSchema: zodToJsonSchema(RequestRideSchema),
  },
  {
    name: 'uber_get_ride_status',
    description: 'Get the current status of a ride request',
    inputSchema: zodToJsonSchema(RideStatusSchema),
  },
  {
    name: 'uber_cancel_ride',
    description: 'Cancel an ongoing ride request',
    inputSchema: zodToJsonSchema(CancelRideSchema),
  },
];

// Create an MCP server that exposes the Uber tools for the given client
export function createUberServer(uberClient: UberClient): Server {
  // Store for user tokens (in production, use secure storage)
  const userTokens = new Map<string, string>();

  const server = new Server(
    {
      name: 'mcp-uber',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS,
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'uber_get_auth_url': {
          const { userId } = AuthorizeSchema.parse(args);
          const authUrl = await uberClient.getAuthorizationUrl(userId);
          return {
            content: [
              {
                type: 'text',
                text: `Please visit this URL to authorize Uber access: ${authUrl}`,
              },
            ],
          };
        }

        case 'uber_set_access_token': {
          const { userId, accessToken } = SetTokenSchema.parse(args);
          userTokens.set(userId, accessToken);
          uberClient.setAccessToken(accessToken);
          return {
            content: [
              {
                type: 'text',
                text: 'Access token set successfully',
              },
            ],
          };
        }

        case 'uber_get_price_estimates': {
          const { userId, startLatitude, startLongitude, endLatitude, endLongitude } =
            PriceEstimateSchema.parse(args);

          const token = userTokens.get(userId);
          if (!token) {
            throw new Error('User not authenticated. Please authorize first.');
          }

          uberClient.setAccessToken(token);
          const estimates = await uberClient.getPriceEstimates(
            startLatitude,
            startLongitude,
            endLatitude,
            endLongitude,
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(estimates, null, 2),
              },
            ],
          };
        }

        case 'uber_request_ride': {
          const {
            userId,
            productId,
            startLatitude,
            startLongitude,
            endLatitude,
            endLongitude,
            fareId,
          } = RequestRideSchema.parse(args);

          const token = userTokens.get(userId);
          if (!token) {
            throw new Error('User not authenticated. Please authorize first.');
          }

          uberClient.setAccessToken(token);
          const rideRequest = await uberClient.requestRide(
            productId,
            startLatitude,
            startLongitude,
            endLatitude,
            endLongitude,
            fareId,
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(rideRequest, null, 2),
              },
            ],
          };
        }

        case 'uber_get_ride_status': {
          const { userId, requestId } = RideStatusSchema.parse(args);

          const token = userTokens.get(userId);
          if (!token) {
            throw new Error('User not authenticated. Please authorize first.');
          }

          uberClient.setAccessToken(token);
          const status = await uberClient.getRideStatus(requestId);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(status, null, 2),
              },
            ],
          };
        }

        case 'uber_cancel_ride': {
          const { userId, requestId } = CancelRideSchema.parse(args);

          const token = userTokens.get(userId);
          if (!token) {
            throw new Error('User not authenticated. Please authorize first.');
          }

          uberClient.setAccessToken(token);
          await uberClient.cancelRide(requestId);

          return {
            content: [
              {
                type: 'text',
                text: 'Ride cancelled successfully',
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  });

  return server;
}

// Start the server
async function main() {
  const uberConfig: UberConfig = {
    clientId: process.env.UBER_CLIENT_ID || '',
    clientSecret: process.env.UBER_CLIENT_SECRET || '',
    serverToken: process.env.UBER_SERVER_TOKEN,
    redirectUri: process.env.UBER_REDIRECT_URI || 'http://localhost:3000/callback',
    apiBaseUrl: process.env.UBER_API_BASE_URL || 'https://api.uber.com',
    authBaseUrl: process.env.UBER_AUTH_BASE_URL || 'https://auth.uber.com',
    environment: (process.env.UBER_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  };

  const uberClient = new UberClient(uberConfig);
  const server = createUberServer(uberClient);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Uber server started');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
