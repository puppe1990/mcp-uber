#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import { readUberConfig } from './config.js';
import { createUberServer } from './server.js';
import { UberClient } from './uber-client.js';

dotenv.config();

async function main() {
  const uberClient = new UberClient(readUberConfig());
  const server = createUberServer(uberClient);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('MCP Uber server started');
}

// Run only when executed directly, so tests can import without starting stdio.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
