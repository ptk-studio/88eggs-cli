// The 88eggs API. Overridable via EGGS_API_URL for local development against a
// local backend. (Prefixed EGGS_, not 88EGGS_: shell env var names can't start
// with a digit.)
//
// Sign-in is Better Auth on this API (POST /auth/sign-in), not Supabase:
// Supabase was removed from 88eggs in 2026-11 (88eggs-backend#361).
export const BACKEND_API_URL =
  process.env.EGGS_API_URL ?? "https://api.88eggs.com";
