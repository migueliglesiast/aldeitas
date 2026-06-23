#!/usr/bin/env npx tsx
/**
 * Verify SMTP credentials and optionally send a test email.
 *
 *   npm run email:test
 *   npm run email:test -- --to you@example.com
 */
import { getEmailConfig, isEmailConfigured } from "../lib/email/config";
import { sendEmail, verifyEmailTransport } from "../lib/email/send";
import {
  renderEmailLayout,
  renderParagraph,
} from "../lib/email/templates/layout";

function readOption(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  if (!isEmailConfigured()) {
    console.error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM in .env");
    process.exit(1);
  }

  const config = getEmailConfig();
  console.log("SMTP host:", config?.host);
  console.log("SMTP port:", config?.port, config?.secure ? "(SSL)" : "(STARTTLS)");
  console.log("From:", config?.from);
  console.log("Notify emails:", config?.notifyEmails.length ? config.notifyEmails.join(", ") : "(hotel owner/managers)");

  const verification = await verifyEmailTransport();
  if (!verification.ok) {
    console.error("SMTP verification failed:", verification.error);
    process.exit(1);
  }
  console.log("SMTP connection verified.");

  const to = readOption("--to") || config?.user;
  if (!to) {
    console.error("Pass --to recipient@example.com or set SMTP_USER.");
    process.exit(1);
  }

  const result = await sendEmail({
    to,
    subject: "Aldeitas email test",
    text: "SMTP is configured correctly. Booking notifications will be sent from this mailbox.",
    html: renderEmailLayout({
      title: "Aldeitas email test",
      preheader: "SMTP is working.",
      bodyHtml: renderParagraph(
        "SMTP is configured correctly. Booking notifications will be sent from this mailbox."
      ),
    }),
  });

  if (!result.sent) {
    console.error("Test email failed:", result.error || result.reason);
    process.exit(1);
  }

  console.log(`Test email sent to ${to}${result.messageId ? ` (messageId: ${result.messageId})` : ""}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
