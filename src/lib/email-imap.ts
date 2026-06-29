import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { GmailMessage } from "@/lib/gmail";

export function imapConfigured(): boolean {
  return !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD);
}

function makeClient() {
  return new ImapFlow({
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASSWORD! },
    logger: false,
  });
}

/**
 * Fetch UNREAD messages whose subject OR body contains "Solution Request".
 * Mirrors the Gmail API importer's contract (same GmailMessage shape).
 */
export async function fetchUnreadSolutionRequestsImap(): Promise<GmailMessage[]> {
  const client = makeClient();
  const out: GmailMessage[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // IMAP search: unseen AND text contains "Solution Request". Return UIDs.
      const uids = await client.search({ seen: false, body: "Solution Request" }, { uid: true });
      const ids = Array.isArray(uids) ? uids : [];
      for (const uid of ids) {
        const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const parsed = await simpleParser(msg.source as Buffer);
        const subject = parsed.subject || "";
        const body = (parsed.text || parsed.html || "").toString().replace(/\s+/g, " ").trim();
        const hay = `${subject}\n${body}`.toLowerCase();
        if (!hay.includes("solution request")) continue;

        out.push({
          id: String(uid), // IMAP UID — stable within the mailbox
          threadId: parsed.messageId || String(uid),
          from: parsed.from?.text || "",
          to: Array.isArray(parsed.to) ? parsed.to.map((t) => t.text).join(", ") : parsed.to?.text || "",
          subject,
          body: body.slice(0, 20000),
          snippet: body.slice(0, 200),
          internalDate: parsed.date || null,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return out;
}

/** Mark a message READ (add \Seen) so it is never re-imported. */
export async function markAsReadImap(uid: string): Promise<void> {
  const client = makeClient();
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
