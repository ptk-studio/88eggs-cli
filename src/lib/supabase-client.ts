import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./constants.js";

// In-memory storage adapter -- Node has no localStorage, and each CLI
// invocation is a fresh process anyway, so there's nothing worth
// persisting via supabase-js's own storage. It only needs *some* backing
// store to hold the PKCE code_verifier between signInWithOAuth() and
// exchangeCodeForSession() within a single `rainbow login` run. Session
// persistence across invocations is handled entirely by our own
// credentials.json (see lib/credentials.ts), not by this client.
function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

export function createAuthClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      flowType: "pkce",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: createMemoryStorage(),
    },
  });
}
