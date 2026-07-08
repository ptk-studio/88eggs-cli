# 88eggs-cli

CLI for 88eggs. Signs in with your Google account (the same one you'd
use on the 88eggs frontend) and talks to `88eggs-backend` on your
behalf. (`88eggs-frontend`/`88eggs-backend` are private repos, not
linked here.)

This exists so [`88eggs-skills`](https://github.com/ptk-studio/88eggs-skills)
has something to drive, mirroring how `vercel-labs/agent-skills`' deploy
skill drives the `vercel` CLI and `supabase/agent-skills` drives the
`supabase` CLI — a skill shells out to `88eggs`, `88eggs` owns its own
login, and no skill ever handles a raw token itself.

## Install

Published on npm as [`88eggs-cli`](https://www.npmjs.com/package/88eggs-cli):

```bash
npm install -g 88eggs-cli
```

Or from source, for local development on the CLI itself:

```bash
pnpm install
pnpm build
npm link   # makes the `88eggs` command available globally
```

## Commands

```bash
88eggs login           # sign in with Google via your browser
88eggs logout          # sign out, remove stored credentials
88eggs whoami           # show the currently signed-in account
88eggs projects list    # list your projects (--scope mine|shared|all)

88eggs media list --project <projectId>   # list a project's media (--tag, --run-name, --page, --limit)
88eggs media liked                        # your liked media, across every accessible project
88eggs media tags [--project <projectId>] # distinct tags (all accessible projects, or one)
88eggs media show <mediaId>               # one item, incl. a signed URL
88eggs media move <mediaId> <projectId>   # move to a different project
88eggs media like <mediaId>                # like
88eggs media unlike <mediaId>              # unlike
88eggs media tag add <mediaId> <tag>       # add one tag
88eggs media tag remove <mediaId> <tag>    # remove one tag

88eggs workflows list                      # the workflow catalog
88eggs workflows show <slug>               # one workflow's detail + parameter spec
88eggs workflows run <slug> [--project <projectId>] [--name <name>] [--param key=value ...]
                                            # start a run; unset parameters use the workflow's
                                            # own defaults; omit --project to use your oldest one;
                                            # omit --name to get "<workflow name> <random word>"
88eggs runs list [--project <projectId>]   # list runs (every accessible project, or one)
                                            # (--page, --limit)
88eggs runs status <runId>                 # poll a run's status, with its jobs

88eggs events types                        # the known event types (run/job started/finished,
                                            # media added)
88eggs events list [--project <projectId>] # list events (every accessible project, or one)
                                            # (--type <eventTypeKey>, --page, --limit)
```

## Using this with an agent

Install [`88eggs-skills`](https://github.com/ptk-studio/88eggs-skills)
to let an agent (Claude Code, etc.) drive this CLI on your behalf:

```bash
npx skills add ptk-studio/88eggs-skills --skill list-projects
```

The skill checks `88eggs whoami` first and only runs `88eggs login`
after asking you — since that opens your browser for a real Google
sign-in — so `88eggs-cli` still needs to be installed and on your
`PATH` (see **Install** above) before the skill can do anything.

## How auth works

`88eggs login` runs a real OAuth flow against the same Supabase project
`88eggs-backend`/`88eggs-frontend` already use — there's no separate
88eggs-specific auth server, and no new backend feature was needed for
this to work:

1. Opens your browser to Supabase's `/auth/v1/authorize?provider=google`
   (the same endpoint the frontend's "Continue with Google" button
   hits), with `redirect_to` pointed at a local callback server this CLI
   starts on a fixed port (`127.0.0.1:51820`).
2. You approve in the browser (or, if already signed in and previously
   consented, this happens instantly with no visible prompt).
3. Supabase redirects back to the local server with an authorization
   code; the CLI exchanges it for a real session (access + refresh
   token) via Supabase's PKCE flow.
4. The session is written to `~/.88eggs/credentials.json` (mode `600`)
   — never printed, never handled by anything other than this file.

Every other command reads that file, refreshing the access token via
the stored refresh token when it's near expiry, and calls
`88eggs-backend` with it as a normal `Authorization: Bearer` header —
exactly what the frontend already sends, just from a CLI instead of a
browser tab. `requireUser()` on the backend doesn't know or care which
one it came from.

**Note on the redirect URL**: this worked against production without
adding `http://127.0.0.1:51820/callback` to Supabase's redirect-URL
allowlist first — empirically, Supabase appears to treat loopback
(`127.0.0.1`/`localhost`) redirects as implicitly trusted for this kind
of installed-app flow (matching the general pattern in
[RFC 8252](https://www.rfc-editor.org/rfc/rfc8252) for native/CLI OAuth
clients), rather than requiring an exact allowlist entry the way a
hosted redirect URL would. Flagging this as observed behavior, not
something confirmed against Supabase's own docs — if a fresh project
ever rejects the redirect, add `http://127.0.0.1:51820/callback` to
**Authentication → URL Configuration → Redirect URLs** in the Supabase
dashboard.

## Local development

Point the CLI at a local Supabase + local `88eggs-backend` instead of
production. Env vars are prefixed `EGGS_`, not `88EGGS_` — shell env var
names can't start with a digit:

```bash
EGGS_SUPABASE_URL=http://127.0.0.1:54321 \
EGGS_SUPABASE_PUBLISHABLE_KEY=<local anon/publishable key> \
EGGS_API_URL=http://localhost:3000 \
88eggs login
```

Local Supabase has Google sign-in **disabled by default**
(`supabase/config.toml`'s `[auth.external.google]` block) — enable it
with real (or test) OAuth credentials first, same as any other local
Google sign-in testing against `88eggs-backend`.

## Testing

```bash
pnpm test        # unit tests (credentials storage, token refresh logic)
pnpm typecheck
pnpm lint
```

The OAuth round-trip itself isn't unit-tested (there's no meaningful way
to fake a real Google consent) — verified manually via `88eggs login`
against production, confirming the credentials file is written
correctly and `88eggs projects list` successfully calls the real API
afterward.
