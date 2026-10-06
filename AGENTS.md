# AGENTS.md

MCP stdio server that books Uber rides. `README.md` covers Uber developer setup and the OAuth flow.

## Commands

- Setup: `npm ci` — prefix with `NODE_ENV=development` if your shell sets `NODE_ENV=production` (it makes npm skip devDependencies and `prepare` fails without `tsc`).
- Test: `npm test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Format: `npm run format` (check: `npm run format:check`)
- Build: `npm run build`
- Full gate: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`

## Structure

- `src/index.ts` — bootstrap: dotenv, stdio transport, direct-execution guard
- `src/server.ts` — `createUberServer(uberClient)`: wires tool list + call handlers into an MCP `Server`
- `src/tool-handlers.ts` — one handler per tool + `requireUserToken` lookups
- `src/tools.ts` — zod input schemas, zod→JSON schema conversion, `uberTools` definitions
- `src/config.ts` — `readUberConfig(env)`: env vars → `UberConfig` with defaults
- `src/uber-client.ts` — thin Uber HTTP client (axios)
- `src/oauth-callback-server.ts` — standalone local OAuth callback; excluded from `npm run build`
- Tests live in `tests/`; `tests/server.test.ts` drives every tool end-to-end over `InMemoryTransport`

## Conventions

- TypeScript ESM (NodeNext): relative imports must end in `.js`.
- Style enforced by Prettier, lint by ESLint — run them, do not hand-format.
- Files under 300 lines (hard cap 500); functions 4–20 lines, one job each.
- Grep-unique names; no `Manager` / `Service` / `util` as primary names.
- Errors include the offending value and the next action.

## Testing

- New behavior requires a new test; bugfixes require a regression test.
- Uber HTTP is mocked (`vi.mock('axios')`); tests must run headless, with no credentials and no network.
- Token state is per `createUberServer` call — build a fresh server per test via `InMemoryTransport`.

## Boundaries

- Ask before: force-push, rewriting `main`, npm publish.
- Never commit `.env`, tokens or real Uber credentials.
- Pre-commit runs lint-staged + `npm test`; fix the failure instead of using `--no-verify`.
