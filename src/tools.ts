import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export const AuthorizeSchema = z.object({
  userId: z.string().describe('Unique identifier for the user'),
});

export const SetTokenSchema = z.object({
  userId: z.string().describe('Unique identifier for the user'),
  accessToken: z.string().describe('Uber access token for the user'),
});

export const PriceEstimateSchema = z.object({
  userId: z.string().describe('Unique identifier for the user'),
  startLatitude: z.number().describe('Starting location latitude'),
  startLongitude: z.number().describe('Starting location longitude'),
  endLatitude: z.number().describe('Destination latitude'),
  endLongitude: z.number().describe('Destination longitude'),
});

export const RequestRideSchema = z.object({
  userId: z.string().describe('Unique identifier for the user'),
  productId: z.string().describe('Uber product ID (from price estimates)'),
  startLatitude: z.number().describe('Starting location latitude'),
  startLongitude: z.number().describe('Starting location longitude'),
  endLatitude: z.number().describe('Destination latitude'),
  endLongitude: z.number().describe('Destination longitude'),
  fareId: z.string().optional().describe('Fare ID from price estimate'),
});

export const RideStatusSchema = z.object({
  userId: z.string().describe('Unique identifier for the user'),
  requestId: z.string().describe('Ride request ID'),
});

export const CancelRideSchema = z.object({
  userId: z.string().describe('Unique identifier for the user'),
  requestId: z.string().describe('Ride request ID to cancel'),
});

interface JsonSchemaProperty {
  type: 'string' | 'number';
  description?: string;
}

// MCP expects JSON Schema while inputs are authored as zod schemas. Only string/number
// properties are supported today — extend here when a tool needs another input kind.
export function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): Tool['inputSchema'] {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(schema.shape)) {
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

    const description = zodType._def.description;
    if (description && properties[key]) {
      properties[key].description = description;
    }
  }

  return { type: 'object', properties, required };
}

export const uberTools: Tool[] = [
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
