import { google } from "googleapis";

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  snippet: string;
  internalDate: Date | null;
}

export function gmailConfigured(): boolean {
  return !!(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  );
}

function gmailClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth: oauth2 });
}

function decodeBody(payload: any): string {
  if (!payload) return "";
  const collect = (part: any): string => {
    let out = "";
    if (part.body?.data && (part.mimeType === "text/plain" || part.mimeType === "text/html")) {
      out += Buffer.from(part.body.data, "base64").toString("utf8");
    }
    if (part.parts) for (const p of part.parts) out += collect(p);
    return out;
  };
  return collect(payload)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function header(headers: any[], name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

/**
 * Search ONLY unread messages where subject OR body contains "Solution Request".
 * Returns full parsed messages.
 */
export async function fetchUnreadSolutionRequests(): Promise<GmailMessage[]> {
  const gmail = gmailClient();
  const user = process.env.GMAIL_USER || "me";

  // Gmail query: unread AND ("Solution Request" appears anywhere — subject or body).
  const q = 'is:unread "Solution Request"';
  const list = await gmail.users.messages.list({ userId: user, q, maxResults: 50 });
  const ids = (list.data.messages || []).map((m) => m.id!).filter(Boolean);

  const out: GmailMessage[] = [];
  for (const id of ids) {
    const msg = await gmail.users.messages.get({ userId: user, id, format: "full" });
    const payload = msg.data.payload;
    const headers = payload?.headers || [];
    const subject = header(headers, "Subject");
    const body = decodeBody(payload);

    // Enforce the rule explicitly: subject contains OR body contains "Solution Request".
    const hay = `${subject}\n${body}`.toLowerCase();
    if (!hay.includes("solution request")) continue;

    out.push({
      id: id,
      threadId: msg.data.threadId || id,
      from: header(headers, "From"),
      to: header(headers, "To"),
      subject,
      body: body.slice(0, 20000),
      snippet: msg.data.snippet || "",
      internalDate: msg.data.internalDate ? new Date(Number(msg.data.internalDate)) : null,
    });
  }
  return out;
}

/** Mark a message READ (remove UNREAD label) so it is never re-imported. */
export async function markAsRead(messageId: string): Promise<void> {
  const gmail = gmailClient();
  const user = process.env.GMAIL_USER || "me";
  await gmail.users.messages.modify({
    userId: user,
    id: messageId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}

/** Send a reply via the Gmail API (oauth mode). Returns the sent message id. */
export async function sendEmailGmail(opts: {
  to: string;
  subject: string;
  text: string;
  threadId?: string;
  inReplyTo?: string;
}): Promise<string> {
  const gmail = gmailClient();
  const user = process.env.GMAIL_USER || "me";
  const headers = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.inReplyTo}`] : []),
  ];
  const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${opts.text}`)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const res = await gmail.users.messages.send({
    userId: user,
    requestBody: { raw, threadId: opts.threadId },
  });
  return res.data.id || "";
}

/** Build OAuth consent URL (one-time, to obtain a refresh token). */
export function buildAuthUrl(): string {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.send",
    ],
  });
}
