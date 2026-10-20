import type { EmailBrand } from "@/lib/email/hotel-brand";
import { escapeHtml } from "@/lib/email/templates/layout";

const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "'Helvetica Neue',Arial,Helvetica,sans-serif";
const INK = "#2f2d2a";
const MUTED = "#6b6660";
const PAPER = "#fbf8f3";

export type StayFact = { label: string; value: string };

export type BrandedEmailOptions = {
  brand: EmailBrand;
  title: string;
  preheader: string;
  eyebrow: string;
  headline: string;
  subline?: string;
  paragraphs: string[];
  heroPhoto?: string | null;
  highlights?: StayFact[];
  facts?: StayFact[];
  galleryPhotos?: string[];
  quote?: string | null;
  ctaLabel?: string;
  ctaUrl?: string;
  showContact?: boolean;
};

export function whatsappLink(phone: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
}

function header(brand: EmailBrand) {
  const logo = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" width="76" height="76" alt="${escapeHtml(brand.hotelName)}" style="display:block;margin:0 auto 14px;width:76px;height:76px;border-radius:38px;border:2px solid rgba(255,255,255,0.55);" />`
    : "";
  const tagline = brand.tagline
    ? `<div style="margin-top:6px;font-family:${SANS};font-size:13px;line-height:1.5;color:rgba(255,255,255,0.82);">${escapeHtml(brand.tagline)}</div>`
    : "";
  return `<tr><td align="center" style="background:${brand.color};padding:30px 28px 26px;">
    <a href="${escapeHtml(brand.siteUrl)}" style="text-decoration:none;">${logo}</a>
    <div style="font-family:${SERIF};font-size:26px;letter-spacing:0.04em;color:#ffffff;">${escapeHtml(brand.hotelName)}</div>
    ${tagline}
  </td></tr>`;
}

function heroImage(url: string, alt: string) {
  return `<tr><td style="padding:0;line-height:0;font-size:0;">
    <img src="${escapeHtml(url)}" width="600" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:600px;height:auto;max-height:340px;object-fit:cover;" />
  </td></tr>`;
}

function highlightsRow(brand: EmailBrand, items: StayFact[]) {
  const width = Math.floor(100 / items.length);
  const cells = items
    .map(
      (item, index) => {
        const divider = index > 0 ? "border-left:1px solid " + brand.colorSoft + ";" : "";
        return `<td width="${width}%" align="center" style="padding:16px 8px;${divider}">
        <div style="font-family:${SANS};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};">${escapeHtml(item.label)}</div>
        <div style="margin-top:6px;font-family:${SERIF};font-size:18px;color:${INK};">${escapeHtml(item.value)}</div>
      </td>`;
      }
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 0;background:#ffffff;border:1px solid ${brand.colorSoft};border-radius:12px;"><tr>${cells}</tr></table>`;
}


function factsTable(items: StayFact[]) {
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:9px 0;border-bottom:1px solid #efe9df;font-family:${SANS};font-size:13px;color:${MUTED};width:42%;vertical-align:top;">${escapeHtml(item.label)}</td>
        <td style="padding:9px 0;border-bottom:1px solid #efe9df;font-family:${SANS};font-size:14px;color:${INK};font-weight:600;vertical-align:top;">${escapeHtml(item.value)}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 0;">${rows}</table>`;
}

function gallery(photos: string[], alt: string) {
  const cells = photos
    .map(
      (url, index) => `<td width="50%" style="padding:0 ${index === 0 ? "5px" : "0"} 0 ${index === 0 ? "0" : "5px"};">
        <img src="${escapeHtml(url)}" width="265" alt="${escapeHtml(alt)}" style="display:block;width:100%;height:auto;max-height:180px;object-fit:cover;border-radius:10px;" />
      </td>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0 0;"><tr>${cells}</tr></table>`;
}

function quoteBlock(brand: EmailBrand, text: string) {
  return `<div style="margin:22px 0 0;padding:4px 0 4px 16px;border-left:3px solid ${brand.color};font-family:${SERIF};font-style:italic;font-size:15px;line-height:1.65;color:${MUTED};">${escapeHtml(text)}</div>`;
}

function contactBlock(brand: EmailBrand) {
  const wa = whatsappLink(brand.contactPhone);
  if (!wa || !brand.contactPhone) return "";
  return `<p style="margin:26px 0 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${MUTED};">
    ¿Dudas? Escríbenos por WhatsApp · Questions? Message us on WhatsApp<br />
    <a href="${escapeHtml(wa)}" style="color:${brand.colorDark};font-weight:600;text-decoration:none;">${escapeHtml(brand.contactPhone)}</a>
  </p>`;
}

export function renderBrandedEmail(options: BrandedEmailOptions) {
  const { brand } = options;
  const subline = options.subline
    ? `<div style="margin-top:6px;font-family:${SERIF};font-style:italic;font-size:16px;color:${MUTED};">${escapeHtml(options.subline)}</div>`
    : "";
  const paragraphs = options.paragraphs
    .map(
      (text) =>
        `<p style="margin:16px 0 0;font-family:${SANS};font-size:15px;line-height:1.65;color:${INK};">${escapeHtml(text)}</p>`
    )
    .join("");
  const cta =
    options.ctaLabel && options.ctaUrl
      ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 0;"><tr><td style="background:${brand.color};border-radius:999px;">
          <a href="${escapeHtml(options.ctaUrl)}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:14px;font-weight:600;letter-spacing:0.02em;color:#ffffff;text-decoration:none;">${escapeHtml(options.ctaLabel)}</a>
        </td></tr></table>`
      : "";
  const footerPlace = [brand.hotelName, brand.location].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(options.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${brand.colorSoft};">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.colorSoft};padding:28px 10px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:${PAPER};border-radius:18px;overflow:hidden;">
          ${header(brand)}
          ${options.heroPhoto ? heroImage(options.heroPhoto, brand.hotelName) : ""}
          <tr><td style="padding:30px 32px 34px;">
            <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${brand.colorDark};">${escapeHtml(options.eyebrow)}</div>
            <div style="margin-top:10px;font-family:${SERIF};font-size:28px;line-height:1.25;color:${INK};">${escapeHtml(options.headline)}</div>
            ${subline}
            ${paragraphs}
            ${options.highlights?.length ? highlightsRow(brand, options.highlights) : ""}
            ${options.facts?.length ? factsTable(options.facts) : ""}
            ${cta}
            ${options.galleryPhotos?.length ? gallery(options.galleryPhotos, brand.hotelName) : ""}
            ${options.quote ? quoteBlock(brand, options.quote) : ""}
            ${options.showContact ? contactBlock(brand) : ""}
          </td></tr>
          <tr><td align="center" style="padding:20px 28px 26px;border-top:1px solid #efe9df;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED};">
            <a href="${escapeHtml(brand.siteUrl)}" style="color:${MUTED};text-decoration:none;font-weight:600;">${escapeHtml(footerPlace)}</a><br />
            Reserva directa con Aldeitas · Direct booking powered by Aldeitas
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
