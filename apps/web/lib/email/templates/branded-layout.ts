import type { EmailBrand } from "@/lib/email/hotel-brand";
import { escapeHtml } from "@/lib/email/templates/layout";

const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "'Helvetica Neue',Arial,Helvetica,sans-serif";
const INK = "#2b2925";
const MUTED = "#736d65";
const PAPER = "#fbf7f0";
const LINE = "#ece4d6";

export type StayFact = { label: string; value: string };

export type StayTicket = {
  checkIn: Date;
  checkOut: Date;
  room: string;
  details: string[];
  facts: StayFact[];
};

export type EmailTip = { icon: string; title: string; text: string; url?: string };

export type BrandedEmailOptions = {
  brand: EmailBrand;
  title: string;
  preheader: string;
  badge: string;
  headline: string;
  countdown?: string | null;
  paragraphs: string[];
  englishNote?: string;
  heroPhoto?: string | null;
  stay?: StayTicket;
  facts?: StayFact[];
  ctaLabel?: string;
  ctaUrl?: string;
  galleryPhotos?: string[];
  galleryCaption?: string;
  quote?: string | null;
  tips?: EmailTip[];
  tipsTitle?: string;
};

export function whatsappLink(phone: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
}

function dayParts(date: Date) {
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-MX", { ...options, timeZone: "UTC" }).format(date).replace(".", "");
  return { day: fmt({ day: "numeric" }), month: fmt({ month: "short" }), weekday: fmt({ weekday: "long" }) };
}

const RESPONSIVE_CSS = `
  body { -webkit-text-size-adjust: 100%; }
  a { text-decoration: none; }
  @media only screen and (max-width: 520px) {
    .card { border-radius: 0 !important; }
    .px { padding-left: 22px !important; padding-right: 22px !important; }
    .h1 { font-size: 30px !important; line-height: 1.2 !important; }
    .stack { display: block !important; width: 100% !important; padding: 0 0 12px 0 !important; }
    .hero { max-height: 300px !important; }
    .btn a { display: block !important; }
    .fact-row td { display: block !important; width: 100% !important; text-align: left !important; padding: 2px 0 !important; }
    .fact-row { display: block !important; padding: 6px 0 !important; }
  }
`;

function header(brand: EmailBrand) {
  const logo = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" width="64" height="64" alt="" style="display:block;margin:0 auto 12px;width:64px;height:64px;border-radius:32px;border:2px solid rgba(255,255,255,0.6);" />`
    : "";
  const tagline = brand.tagline
    ? `<div style="margin-top:6px;font-family:${SERIF};font-style:italic;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.85);">${escapeHtml(brand.tagline)}</div>`
    : "";
  return `<tr><td align="center" class="px" style="background:${brand.color};padding:28px 32px 24px;">
    <a href="${escapeHtml(brand.siteUrl)}">${logo}</a>
    <div style="font-family:${SERIF};font-size:22px;letter-spacing:0.18em;text-transform:uppercase;color:#ffffff;">${escapeHtml(brand.hotelName)}</div>
    ${tagline}
  </td></tr>`;
}

function hero(url: string, alt: string) {
  return `<tr><td style="padding:0;line-height:0;font-size:0;">
    <img src="${escapeHtml(url)}" width="600" alt="${escapeHtml(alt)}" class="hero" style="display:block;width:100%;max-width:600px;height:auto;max-height:360px;object-fit:cover;" />
  </td></tr>`;
}

function badge(brand: EmailBrand, text: string) {
  return `<span style="display:inline-block;padding:7px 14px;border-radius:999px;background:${brand.colorSoft};font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${brand.colorDark};">${escapeHtml(text)}</span>`;
}

function dateCell(brand: EmailBrand, label: string, date: Date, align: "left" | "right") {
  const { day, month, weekday } = dayParts(date);
  return `<td width="44%" align="${align}" style="vertical-align:top;">
    <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</div>
    <div style="margin-top:4px;font-family:${SERIF};font-size:44px;line-height:1;color:${brand.color};">${escapeHtml(day)}</div>
    <div style="margin-top:4px;font-family:${SANS};font-size:14px;color:${INK};text-transform:capitalize;">${escapeHtml(`${month} · ${weekday}`)}</div>
  </td>`;
}

function stayTicket(brand: EmailBrand, stay: StayTicket) {
  const details = stay.details.length
    ? `<div style="margin-top:4px;font-family:${SANS};font-size:14px;color:${MUTED};">${escapeHtml(stay.details.join(" · "))}</div>`
    : "";
  const facts = stay.facts
    .map(
      (fact) => `<tr class="fact-row">
        <td style="padding:6px 0;font-family:${SANS};font-size:13px;color:${MUTED};">${escapeHtml(fact.label)}</td>
        <td align="right" style="padding:6px 0;font-family:${SANS};font-size:14px;font-weight:700;color:${INK};word-break:break-all;">${escapeHtml(fact.value)}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0 0;background:#ffffff;border-radius:18px;border-top:5px solid ${brand.color};box-shadow:0 1px 0 ${LINE};">
    <tr><td style="padding:22px 22px 6px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
        ${dateCell(brand, "Llegada · In", stay.checkIn, "left")}
        <td width="12%" align="center" style="vertical-align:middle;font-family:${SERIF};font-size:26px;color:${brand.color};">→</td>
        ${dateCell(brand, "Salida · Out", stay.checkOut, "right")}
      </tr></table>
    </td></tr>
    <tr><td style="padding:16px 22px 0;"><div style="border-top:2px dashed ${LINE};height:0;line-height:0;font-size:0;">&nbsp;</div></td></tr>
    <tr><td style="padding:16px 22px 0;">
      <div style="font-family:${SERIF};font-size:20px;color:${INK};">${escapeHtml(stay.room)}</div>
      ${details}
    </td></tr>
    <tr><td style="padding:12px 22px 18px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${facts}</table></td></tr>
  </table>`;
}

function factsList(items: StayFact[]) {
  const rows = items
    .map(
      (item) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${LINE};">
        <div style="font-family:${SANS};font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">${escapeHtml(item.label)}</div>
        <div style="margin-top:3px;font-family:${SANS};font-size:16px;font-weight:600;color:${INK};word-break:break-word;">${escapeHtml(item.value)}</div>
      </td></tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 0;">${rows}</table>`;
}

function button(brand: EmailBrand, label: string, url: string) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0 0;"><tr><td align="center" class="btn" style="background:${brand.color};border-radius:14px;">
    <a href="${escapeHtml(url)}" style="display:block;padding:16px 24px;font-family:${SANS};font-size:16px;font-weight:700;color:#ffffff;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

function gallery(photos: string[], caption: string | undefined, alt: string) {
  const cells = photos
    .map(
      (url, index) => `<td width="50%" class="stack" style="padding:0 ${index === 0 ? "6px" : "0"} 0 ${index === 0 ? "0" : "6px"};vertical-align:top;">
        <img src="${escapeHtml(url)}" width="270" alt="${escapeHtml(alt)}" style="display:block;width:100%;height:auto;max-height:220px;object-fit:cover;border-radius:14px;" />
      </td>`
    )
    .join("");
  const captionHtml = caption
    ? `<div style="margin:0 0 12px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">${escapeHtml(caption)}</div>`
    : "";
  return `<div style="margin:34px 0 0;">${captionHtml}<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${cells}</tr></table></div>`;
}

function quote(brand: EmailBrand, text: string) {
  return `<div style="margin:20px 0 0;padding:18px 20px;border-radius:14px;background:${brand.colorSoft};font-family:${SERIF};font-style:italic;font-size:16px;line-height:1.6;color:${INK};">“${escapeHtml(text)}”</div>`;
}

function tipsBlock(brand: EmailBrand, tips: EmailTip[], title: string) {
  const rows = tips
    .map((tip) => {
      const title = tip.url
        ? `<a href="${escapeHtml(tip.url)}" style="color:${brand.colorDark};font-weight:700;">${escapeHtml(tip.title)} ›</a>`
        : `<span style="font-weight:700;color:${INK};">${escapeHtml(tip.title)}</span>`;
      return `<tr>
        <td width="44" style="padding:12px 0;vertical-align:top;"><div style="width:36px;height:36px;border-radius:18px;background:${brand.colorSoft};text-align:center;line-height:36px;font-size:18px;">${tip.icon}</div></td>
        <td style="padding:12px 0;vertical-align:top;font-family:${SANS};font-size:15px;line-height:1.5;">${title}<div style="color:${MUTED};font-size:14px;">${escapeHtml(tip.text)}</div></td>
      </tr>`;
    })
    .join("");
  return `<div style="margin:34px 0 0;">
    <div style="font-family:${SERIF};font-size:22px;color:${INK};">${escapeHtml(title)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:6px;">${rows}</table>
  </div>`;
}

export function renderBrandedEmail(options: BrandedEmailOptions) {
  const { brand } = options;
  const countdown = options.countdown
    ? `<div style="margin-top:10px;font-family:${SERIF};font-style:italic;font-size:18px;color:${brand.colorDark};">${escapeHtml(options.countdown)}</div>`
    : "";
  const paragraphs = options.paragraphs
    .map(
      (text) =>
        `<p style="margin:16px 0 0;font-family:${SANS};font-size:16px;line-height:1.65;color:${INK};">${escapeHtml(text)}</p>`
    )
    .join("");
  const english = options.englishNote
    ? `<p style="margin:12px 0 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${MUTED};"><span style="font-weight:700;">EN</span> · ${escapeHtml(options.englishNote)}</p>`
    : "";
  const footerPlace = [brand.hotelName, brand.location].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(options.title)}</title>
    <style>${RESPONSIVE_CSS}</style>
  </head>
  <body style="margin:0;padding:0;background:${brand.colorSoft};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.colorSoft};">
      <tr><td align="center" style="padding:24px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="card" style="max-width:600px;background:${PAPER};border-radius:22px;overflow:hidden;">
          ${header(brand)}
          ${options.heroPhoto ? hero(options.heroPhoto, brand.hotelName) : ""}
          <tr><td class="px" style="padding:30px 36px 36px;">
            ${badge(brand, options.badge)}
            <div class="h1" style="margin-top:16px;font-family:${SERIF};font-size:34px;line-height:1.15;color:${INK};">${escapeHtml(options.headline)}</div>
            ${countdown}
            ${paragraphs}
            ${english}
            ${options.stay ? stayTicket(brand, options.stay) : ""}
            ${options.facts?.length ? factsList(options.facts) : ""}
            ${options.ctaLabel && options.ctaUrl ? button(brand, options.ctaLabel, options.ctaUrl) : ""}
            ${options.galleryPhotos?.length ? gallery(options.galleryPhotos, options.galleryCaption, brand.hotelName) : ""}
            ${options.quote ? quote(brand, options.quote) : ""}
            ${options.tips?.length ? tipsBlock(brand, options.tips, options.tipsTitle ?? "Antes de llegar") : ""}
          </td></tr>
          <tr><td align="center" class="px" style="background:${brand.color};padding:22px 32px;font-family:${SANS};font-size:12px;line-height:1.7;color:rgba(255,255,255,0.8);">
            <a href="${escapeHtml(brand.siteUrl)}" style="color:#ffffff;font-weight:700;letter-spacing:0.08em;">${escapeHtml(footerPlace)}</a><br />
            Reserva directa con Aldeitas · Direct booking powered by Aldeitas
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
