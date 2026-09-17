export const SITE_NAME = "Aldeitas";

export type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
  notifyEmails: string[];
};

function parseBool(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function parseNotifyEmails() {
  const raw = process.env.BOOKING_NOTIFY_EMAIL?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export function isEmailConfigured() {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  return Boolean(process.env.SMTP_HOST && from);
}

export function getEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.EMAIL_FROM?.trim() || process.env.SMTP_FROM?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  if (!host || !from || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? parseBool(process.env.SMTP_SECURE, false)
      : port === 465;

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
    notifyEmails: parseNotifyEmails(),
  };
}

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
}
