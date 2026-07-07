# rainbow-cli

CLI for [Rainbow](https://github.com/thomaskwan/rainbow-frontend). Signs
in with your Google account (the same one you'd use on the Rainbow
frontend) and talks to
[`rainbow-backend`](https://github.com/thomaskwan/rainbow-backend) on
your behalf.

This exists so [`rainbow-skills`](https://github.com/ptk-studio/rainbow-skills)
has something to drive, mirroring how `vercel-labs/agent-skills`' deploy
skill drives the `vercel` CLI and `supabase/agent-skills` drives the
`supabase` CLI — a skill shells out to `rainbow`, `rainbow` owns its own
login, and no skill ever handles a raw token itself.

## Install

```bash
pnpm install
pnpm build
npm link   # makes the `rainbow` command available globally
```

## Commands

```bash
rainbow login           # sign in with Google via your browser
rainbow logout          # sign out, remove stored credentials
rainbow whoami           # show the currently signed-in account
rainbow projects list    # list your projects (--scope mine|shared|all)
```

## How auth works

`rainbow login` runs a real OAuth flow against the same Supabase project
`rainbow-backend`/`rainbow-frontend` already use — there's no separate
Rainbow-specific auth server, and no new backend feature was needed for
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
4. The session is written to `~/.rainbow/credentials.json` (mode `600`)
   — never printed, never handled by anything other than this file.

Every other command reads that file, refreshing the access token via
the stored refresh token when it's near expiry, and calls
`rainbow-backend` with it as a normal `Authorization: Bearer` header —
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

Point the CLI at a local Supabase + local `rainbow-backend` instead of
production:

```bash
RAINBOW_SUPABASE_URL=http://127.0.0.1:54321 \
RAINBOW_SUPABASE_PUBLISHABLE_KEY=<local anon/publishable key> \
RAINBOW_API_URL=http://localhost:3000 \
rainbow login
```

Local Supabase has Google sign-in **disabled by default**
(`supabase/config.toml`'s `[auth.external.google]` block) — enable it
with real (or test) OAuth credentials first, same as any other local
Google sign-in testing against `rainbow-backend`.

## Testing

```bash
pnpm test        # unit tests (credentials storage, token refresh logic)
pnpm typecheck
pnpm lint
```

The OAuth round-trip itself isn't unit-tested (there's no meaningful way
to fake a real Google consent) — verified manually via `rainbow login`
against production, confirming the credentials file is written
correctly and `rainbow projects list` successfully calls the real API
afterward.
