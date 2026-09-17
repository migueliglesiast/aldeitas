import { SITE_NAME } from "@/lib/email/config";

type LayoutOptions = {
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderEmailLayout({
  title,
  preheader = "",
  bodyHtml,
  ctaLabel,
  ctaUrl,
}: LayoutOptions) {
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<p style="margin:28px 0 0;">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;">
            ${escapeHtml(ctaLabel)}
          </a>
        </p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px 8px;font-size:22px;font-weight:700;color:#0f766e;letter-spacing:0.02em;">
                ${escapeHtml(SITE_NAME)}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px;font-size:15px;line-height:1.6;">
                ${bodyHtml}
                ${ctaBlock}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px;border-top:1px solid #f1f5f9;font-size:12px;line-height:1.5;color:#64748b;">
                This message was sent by ${escapeHtml(SITE_NAME)}. Please do not reply to this automated email unless a contact address is provided.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderDetailsTable(rows: Array<{ label: string; value: string }>) {
  const items = rows
    .map(
      ({ label, value }) => `<tr>
        <td style="padding:8px 0;color:#64748b;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:8px 0;color:#111827;font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 0;border-top:1px solid #f1f5f9;padding-top:8px;">
    ${items}
  </table>`;
}

export function renderParagraph(text: string) {
  return `<p style="margin:0 0 14px;">${escapeHtml(text)}</p>`;
}
