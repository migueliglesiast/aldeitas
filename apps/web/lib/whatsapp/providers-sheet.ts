import { prisma } from "@/lib/prisma";

export type ProviderRow = {
  service: string;
  audience: string;
  priority: number;
  name: string;
  phone: string;
  notes: string | null;
};

export const EMERGENCY_SERVICES = {
  plumbing: "Plomería",
  electrical: "Electrico",
} as const;

export type EmergencyService = keyof typeof EMERGENCY_SERVICES;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Parses the providers sheet: Servicio, Huesped/Cliente, prioridad, Nombre de persona, LADA, numero, CLABE, Notas. A blank Servicio continues the one above. */
export function parseProvidersCsv(csv: string): ProviderRow[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return [];
  const cols = header.map(normalizeHeader);
  const idx = (prefix: string) => cols.findIndex((c) => c.startsWith(prefix));
  const iService = idx("servicio");
  const iAudience = idx("huesped");
  const iPriority = idx("prioridad");
  const iName = idx("nombre");
  const iLada = idx("lada");
  const iNumber = idx("numero");
  const iNotes = idx("notas");

  const out: ProviderRow[] = [];
  let service = "";
  for (const row of rows) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    if (cell(iService)) service = cell(iService);
    const name = cell(iName);
    const number = cell(iNumber).replace(/\D/g, "");
    const priority = Number(cell(iPriority));
    if (!service || !name || number.length < 8 || !Number.isFinite(priority)) continue;
    const lada = cell(iLada).replace(/\D/g, "") || "52";
    out.push({
      service,
      audience: cell(iAudience).toUpperCase(),
      priority,
      name,
      phone: `${lada}${number}`,
      notes: cell(iNotes) || null,
    });
  }
  return out;
}

export function serviceMatches(sheetService: string, service: EmergencyService) {
  return normalizeHeader(sheetService) === normalizeHeader(EMERGENCY_SERVICES[service]);
}

export async function syncProvidersFromSheet(csvUrl = process.env.WHATSAPP_PROVIDERS_SHEET_CSV_URL) {
  if (!csvUrl) return { synced: 0, skipped: true };
  const res = await fetch(csvUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`providers sheet ${res.status}`);
  const rows = parseProvidersCsv(await res.text());
  if (rows.length === 0) throw new Error("providers sheet has no rows");
  await prisma.$transaction([prisma.serviceProvider.deleteMany({}), prisma.serviceProvider.createMany({ data: rows })]);
  return { synced: rows.length, skipped: false };
}

/** "C" (cliente) rows are the hotel's own providers; "H" (huésped) rows are services recommended to guests. */
export const AUDIENCE_HOTEL = "C";
export const AUDIENCE_GUEST = "H";

export async function rankedProviders(service: EmergencyService) {
  const all = await prisma.serviceProvider.findMany({
    where: { audience: AUDIENCE_HOTEL },
    orderBy: { priority: "asc" },
  });
  return all.filter((p) => serviceMatches(p.service, service));
}

export async function guestServices() {
  const rows = await prisma.serviceProvider.findMany({
    where: { audience: AUDIENCE_GUEST },
    orderBy: [{ service: "asc" }, { priority: "asc" }],
  });
  return rows.map((p) => ({ service: p.service, name: p.name, phone: `+${p.phone}` }));
}
