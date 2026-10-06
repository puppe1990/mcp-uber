import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { toolHandlers } from './tool-handlers.js';
import { uberTools } from './tools.js';
import type { UberClient } from './uber-client.js';

export function createUberServer(uberClient: UberClient): Server {
  // In-memory token store: demo only. Swap for secure per-user storage before production use.
  const userTokens = new Map<string, string>();

  const server = new Server(
    { name: 'mcp-uber', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: uberTools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const handler = toolHandlers[name];
      if (!handler) {
        throw new Error(
          `Unknown tool: ${name}. Available tools: ${Object.keys(toolHandlers).join(', ')}`,
        );
      }

      const text = await handler({ uberClient, userTokens }, args);
      return { content: [{ type: 'text', text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { content: [{ type: 'text', text: `Error: ${message}` }] };
    }
  });

  return server;
}
