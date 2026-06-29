import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

/**
 * OAuth2 callback. Exchanges the code for tokens and shows the refresh token
 * once so it can be pasted into GMAIL_REFRESH_TOKEN in .env.
 * (One-time setup; not part of the normal request path.)
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  const { tokens } = await oauth2.getToken(code);

  return new NextResponse(
    `<html><body style="font-family:system-ui;padding:2rem">
      <h2>Gmail connected</h2>
      <p>Copy this refresh token into <code>GMAIL_REFRESH_TOKEN</code> in your .env, then restart:</p>
      <pre style="background:#f4f4f5;padding:1rem;border-radius:8px;word-break:break-all">${tokens.refresh_token ?? "(none — re-run with prompt=consent)"}</pre>
    </body></html>`,
    { headers: { "content-type": "text/html" } }
  );
}
