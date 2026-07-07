import { createServer } from "node:http";
import open from "open";
import { createAuthClient } from "../lib/supabase-client.js";
import { saveCredentials } from "../lib/credentials.js";
import { LOGIN_CALLBACK_PORT, LOGIN_CALLBACK_URL } from "../lib/constants.js";

const SUCCESS_HTML = `<!doctype html><html><body style="font-family: system-ui; text-align: center; padding: 4rem;">
<h1>Signed in to 88eggs</h1><p>You can close this tab and return to your terminal.</p>
</body></html>`;

const ERROR_HTML = (message: string) => `<!doctype html><html><body style="font-family: system-ui; text-align: center; padding: 4rem;">
<h1>Sign-in failed</h1><p>${message}</p><p>You can close this tab and return to your terminal.</p>
</body></html>`;

export async function login(): Promise<void> {
  const supabase = createAuthClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: LOGIN_CALLBACK_URL,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error("Failed to start sign-in:", error?.message ?? "no URL returned");
    process.exitCode = 1;
    return;
  }

  console.log("Opening your browser to sign in with Google...");
  console.log(`If it doesn't open automatically, visit:\n  ${data.url}\n`);

  const result = await waitForCallback(supabase, data.url);
  if (!result.ok) {
    console.error(`Sign-in failed: ${result.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Signed in as ${result.email}.`);
}

function waitForCallback(
  supabase: ReturnType<typeof createAuthClient>,
  authUrl: string,
): Promise<{ ok: true; email: string } | { ok: false; message: string }> {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", LOGIN_CALLBACK_URL);
      if (url.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }

      const code = url.searchParams.get("code");
      const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

      void (async () => {
        if (oauthError) {
          response.writeHead(200, { "Content-Type": "text/html" }).end(ERROR_HTML(oauthError));
          server.close();
          resolve({ ok: false, message: oauthError });
          return;
        }

        if (!code) {
          response.writeHead(400, { "Content-Type": "text/html" }).end(ERROR_HTML("No authorization code received."));
          server.close();
          resolve({ ok: false, message: "No authorization code received." });
          return;
        }

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.session) {
          response.writeHead(200, { "Content-Type": "text/html" }).end(ERROR_HTML(error?.message ?? "Could not complete sign-in."));
          server.close();
          resolve({ ok: false, message: error?.message ?? "Could not complete sign-in." });
          return;
        }

        await saveCredentials({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at ?? Math.floor(Date.now() / 1000) + data.session.expires_in,
          email: data.session.user.email ?? "",
        });

        response.writeHead(200, { "Content-Type": "text/html" }).end(SUCCESS_HTML);
        server.close();
        resolve({ ok: true, email: data.session.user.email ?? "unknown" });
      })();
    });

    server.listen(LOGIN_CALLBACK_PORT, () => {
      void open(authUrl);
    });

    server.on("error", (err) => {
      resolve({ ok: false, message: `Could not start local callback server: ${err.message}` });
    });
  });
}
