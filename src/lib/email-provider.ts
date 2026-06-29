import type { GmailMessage } from "@/lib/gmail";
import { fetchUnreadSolutionRequests, markAsRead, gmailConfigured, sendEmailGmail } from "@/lib/gmail";
import { fetchUnreadSolutionRequestsImap, markAsReadImap, imapConfigured } from "@/lib/email-imap";
import { sendEmailSmtp, smtpConfigured } from "@/lib/email-smtp";

type Provider = "imap" | "oauth";

function provider(): Provider {
  const p = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (p === "imap") return "imap";
  if (p === "oauth") return "oauth";
  // Auto: prefer whatever is configured.
  return imapConfigured() ? "imap" : "oauth";
}

export function emailConfigured(): boolean {
  return provider() === "imap" ? imapConfigured() : gmailConfigured();
}

export function emailProviderName(): string {
  return provider();
}

/** Provider-agnostic fetch of unread "Solution Request" messages. */
export function fetchUnreadSolutionRequestsAny(): Promise<GmailMessage[]> {
  return provider() === "imap" ? fetchUnreadSolutionRequestsImap() : fetchUnreadSolutionRequests();
}

/** Provider-agnostic mark-as-read. */
export function markEmailAsRead(id: string): Promise<void> {
  return provider() === "imap" ? markAsReadImap(id) : markAsRead(id);
}

export function replyConfigured(): boolean {
  return provider() === "imap" ? smtpConfigured() : gmailConfigured();
}

/** Provider-agnostic reply/send. Returns the outbound message id. */
export function sendReply(opts: {
  to: string;
  subject: string;
  text: string;
  threadId?: string;
  inReplyTo?: string;
}): Promise<string> {
  if (provider() === "imap") {
    return sendEmailSmtp({ to: opts.to, subject: opts.subject, text: opts.text, inReplyTo: opts.inReplyTo, references: opts.inReplyTo });
  }
  return sendEmailGmail(opts);
}
