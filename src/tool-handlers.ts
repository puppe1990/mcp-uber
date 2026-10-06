import type { UberClient } from './uber-client.js';
import {
  AuthorizeSchema,
  CancelRideSchema,
  PriceEstimateSchema,
  RequestRideSchema,
  RideStatusSchema,
  SetTokenSchema,
} from './tools.js';

export interface ToolContext {
  uberClient: UberClient;
  userTokens: Map<string, string>;
}

export type ToolHandler = (context: ToolContext, args: unknown) => Promise<string>;

function requireUserToken(userTokens: Map<string, string>, userId: string): string {
  const token = userTokens.get(userId);
  if (!token) {
    throw new Error(
      `User "${userId}" is not authenticated. Call uber_get_auth_url, then uber_set_access_token with the code.`,
    );
  }
  return token;
}

const handleGetAuthUrl: ToolHandler = async ({ uberClient }, args) => {
  const { userId } = AuthorizeSchema.parse(args);
  const authUrl = await uberClient.getAuthorizationUrl(userId);
  return `Please visit this URL to authorize Uber access: ${authUrl}`;
};

const handleSetAccessToken: ToolHandler = async ({ uberClient, userTokens }, args) => {
  const { userId, accessToken } = SetTokenSchema.parse(args);
  userTokens.set(userId, accessToken);
  uberClient.setAccessToken(accessToken);
  return 'Access token set successfully';
};

const handleGetPriceEstimates: ToolHandler = async ({ uberClient, userTokens }, args) => {
  const { userId, startLatitude, startLongitude, endLatitude, endLongitude } =
    PriceEstimateSchema.parse(args);
  uberClient.setAccessToken(requireUserToken(userTokens, userId));

  const estimates = await uberClient.getPriceEstimates(
    startLatitude,
    startLongitude,
    endLatitude,
    endLongitude,
  );
  return JSON.stringify(estimates, null, 2);
};

const handleRequestRide: ToolHandler = async ({ uberClient, userTokens }, args) => {
  const { userId, productId, startLatitude, startLongitude, endLatitude, endLongitude, fareId } =
    RequestRideSchema.parse(args);
  uberClient.setAccessToken(requireUserToken(userTokens, userId));

  const rideRequest = await uberClient.requestRide(
    productId,
    startLatitude,
    startLongitude,
    endLatitude,
    endLongitude,
    fareId,
  );
  return JSON.stringify(rideRequest, null, 2);
};

const handleGetRideStatus: ToolHandler = async ({ uberClient, userTokens }, args) => {
  const { userId, requestId } = RideStatusSchema.parse(args);
  uberClient.setAccessToken(requireUserToken(userTokens, userId));

  const status = await uberClient.getRideStatus(requestId);
  return JSON.stringify(status, null, 2);
};

const handleCancelRide: ToolHandler = async ({ uberClient, userTokens }, args) => {
  const { userId, requestId } = CancelRideSchema.parse(args);
  uberClient.setAccessToken(requireUserToken(userTokens, userId));

  await uberClient.cancelRide(requestId);
  return 'Ride cancelled successfully';
};

export const toolHandlers: Record<string, ToolHandler> = {
  uber_get_auth_url: handleGetAuthUrl,
  uber_set_access_token: handleSetAccessToken,
  uber_get_price_estimates: handleGetPriceEstimates,
  uber_request_ride: handleRequestRide,
  uber_get_ride_status: handleGetRideStatus,
  uber_cancel_ride: handleCancelRide,
};
