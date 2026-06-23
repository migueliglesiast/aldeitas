import { getEmailConfig, isEmailConfigured } from "@/lib/email/config";
import { getEmailTransport } from "@/lib/email/transport";
import type { EmailPayload, EmailSendResult } from "@/lib/email/types";

function normalizeRecipients(to: string | string[]) {
  const list = Array.isArray(to) ? to : [to];
  return [...new Set(list.map((email) => email.trim()).filter(Boolean))];
}

function logDisabledEmail(payload: EmailPayload) {
  const recipients = normalizeRecipients(payload.to).join(", ");
  console.log(
    `[email] SMTP not configured — logging instead\nSubject: ${payload.subject}\nTo: ${recipients}\n${payload.text}`
  );
}

export async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  const recipients = normalizeRecipients(payload.to);
  if (recipients.length === 0) {
    return { sent: false, reason: "error", error: "No recipients" };
  }

  const transport = getEmailTransport();
  const config = getEmailConfig();

  if (!transport || !config) {
    logDisabledEmail({ ...payload, to: recipients });
    return { sent: false, reason: "disabled" };
  }

  try {
    const info = await transport.sendMail({
      from: config.from,
      to: recipients.join(", "),
      replyTo: payload.replyTo || config.replyTo,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    return { sent: true, messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[email] Failed to send "${payload.subject}" to ${recipients.join(", ")}:`, error);
    return { sent: false, reason: "error", error: message };
  }
}

export async function verifyEmailTransport() {
  if (!isEmailConfigured()) {
    return { ok: false as const, error: "SMTP is not configured" };
  }

  const transport = getEmailTransport();
  if (!transport) {
    return { ok: false as const, error: "SMTP transport could not be created" };
  }

  try {
    await transport.verify();
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false as const, error: message };
  }
}
