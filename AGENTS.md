# Agent guidelines — 88eggs-cli

A small **TypeScript** Node CLI (`commander`) that signs in to 88eggs'
existing Supabase project and calls `88eggs-backend`. See `README.md`
for the auth flow design before making non-trivial changes.

## TypeScript

- `strict` mode is on (`tsconfig.json`) — keep it on, no `any` or
  `// @ts-ignore` to route around a type error.
- ESM throughout (`"type": "module"`); relative imports use explicit
  `.js` extensions (Node's ESM resolution requires it even though the
  source files are `.ts` — this isn't a typo, don't "fix" it to `.ts`).
- New commands go in `src/commands/`, one file per command/subcommand
  group; shared logic (credentials storage, the authenticated fetch
  wrapper, the Supabase client factory) lives in `src/lib/`.

## Authentication

- `88eggs login` is the **only** place that talks to Supabase's OAuth
  endpoints directly. Every other command reads `~/.88eggs/credentials.json`
  via `src/lib/credentials.ts` and calls the backend via
  `apiFetch()` (`src/lib/api.ts`), which handles refresh-on-near-expiry
  itself — don't reimplement token handling in a new command.
- Never print the raw access or refresh token to stdout/stderr, and
  never add a flag that would. If a user needs to debug their session,
  point them at `88eggs whoami` (email only) or the credentials file's
  existence/permissions, not its contents.
- `~/.88eggs/credentials.json` must stay mode `600` — `saveCredentials()`
  already sets this; don't add a second write path that skips it.
- `EGGS_CONFIG_DIR` env var override exists purely for tests — don't
  repurpose it as a user-facing multi-account feature without thinking
  through what that actually needs (separate credential files, a
  `--profile` flag, etc. — real design work, not a side effect of a test
  hook).

## Commands

- Every command handles its own errors and sets `process.exitCode = 1`
  on failure (never `process.exit()` mid-async-operation — let pending
  I/O flush) rather than throwing uncaught, so a skill driving this CLI
  gets a clean non-zero exit code and a readable stderr message, not a
  stack trace.
- Keep output script-friendly: plain text to stdout for success, errors
  to stderr with an `Error:` prefix where applicable. No colors/spinners
  — this is driven by agents at least as often as humans.

## Unit tests

- Test runner is **Vitest**. Colocate tests (`src/lib/foo.ts` →
  `src/lib/foo.test.ts`).
- What's realistically testable: `credentials.ts` (real file I/O against
  a temp dir via `EGGS_CONFIG_DIR`) and `api.ts` (token-refresh
  branching, with `credentials.ts`/`supabase-client.ts` mocked).
- What isn't: the actual OAuth round-trip in `login.ts` (no meaningful
  way to fake a real Google consent screen) — verify that manually
  (`88eggs login` against a real account) after any change to
  `login.ts`, don't assume it still works from the unit-testable parts
  passing.

## Git workflow

- Every change goes through a pull request — create a feature branch,
  push it, open a PR, and merge through GitHub. Never commit directly
  to `main`.

## Before committing

- `pnpm typecheck`, `pnpm lint`, and `pnpm test` must pass.
- `pnpm build && node dist/index.js --help` — confirm the CLI actually
  starts; a build can succeed while `index.ts`'s command wiring is
  broken.
- If a change touches `login.ts`, `api.ts`, or `credentials.ts`, do a
  real manual pass (`88eggs login`, `88eggs whoami`,
  `88eggs projects list`, `88eggs logout`) — this is the one part of
  the codebase that can't be verified by the test suite alone.
