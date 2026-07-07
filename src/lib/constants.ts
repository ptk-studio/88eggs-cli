// Public, client-safe values -- same ones rainbow-frontend embeds in its
// own bundle (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).
// Overridable via env vars for local development against a local
// Supabase/backend instance.
export const SUPABASE_URL =
  process.env.RAINBOW_SUPABASE_URL ?? "https://kuptszxhqksekiltppgu.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.RAINBOW_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_91cZ6e6YU1MrEoZbBbXaXA_Rk0TuAHT";

export const BACKEND_API_URL =
  process.env.RAINBOW_API_URL ?? "https://rainbow-backend-two.vercel.app";

// Fixed port for the login callback server -- fixed (not random) so it
// can be added once to Supabase's redirect-URL allowlist as an exact
// match, no wildcard needed.
export const LOGIN_CALLBACK_PORT = 51820;
export const LOGIN_CALLBACK_URL = `http://127.0.0.1:${LOGIN_CALLBACK_PORT}/callback`;
