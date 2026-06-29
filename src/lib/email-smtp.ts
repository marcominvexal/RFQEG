import nodemailer from "nodemailer";

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string; // Message-ID being replied to
  references?: string;
}

export function smtpConfigured(): boolean {
  return !!(
    (process.env.SMTP_USER || process.env.IMAP_USER) &&
    (process.env.SMTP_PASSWORD || process.env.IMAP_PASSWORD)
  );
}

function transport() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER || process.env.IMAP_USER,
      pass: process.env.SMTP_PASSWORD || process.env.IMAP_PASSWORD,
    },
  });
}

/** Send an email over SMTP (Gmail app password). Returns the message id. */
export async function sendEmailSmtp(mail: OutboundEmail): Promise<string> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.IMAP_USER!;
  const info = await transport().sendMail({
    from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    inReplyTo: mail.inReplyTo,
    references: mail.references,
  });
  return info.messageId;
}
