/** Mexican banks keyed by the first 3 CLABE digits (Banxico participant code). */
export type MexicanBank = { code: string; name: string; logo: string | null };

const BANKS = new Map<string, { name: string; logo: string | null }>(
  Object.entries({
    "002": { name: "Banamex", logo: "/banks/002.png" },
    "006": { name: "Bancomext", logo: "/banks/006.png" },
    "009": { name: "Banobras", logo: null },
    "012": { name: "BBVA", logo: "/banks/012.png" },
    "014": { name: "Santander", logo: "/banks/014.png" },
    "019": { name: "Banjército", logo: null },
    "021": { name: "HSBC", logo: "/banks/021.png" },
    "030": { name: "BanBajío", logo: "/banks/030.png" },
    "036": { name: "Inbursa", logo: "/banks/036.png" },
    "042": { name: "Mifel", logo: "/banks/042.png" },
    "044": { name: "Scotiabank", logo: "/banks/044.png" },
    "058": { name: "Banregio", logo: "/banks/058.png" },
    "059": { name: "Invex", logo: "/banks/059.png" },
    "060": { name: "Bansi", logo: null },
    "062": { name: "Afirme", logo: "/banks/062.png" },
    "072": { name: "Banorte", logo: "/banks/072.png" },
    "106": { name: "Bank of America", logo: "/banks/106.png" },
    "112": { name: "Monex", logo: "/banks/112.png" },
    "113": { name: "Ve por Más", logo: "/banks/113.png" },
    "127": { name: "Banco Azteca", logo: "/banks/127.png" },
    "128": { name: "Autofin", logo: "/banks/128.png" },
    "130": { name: "Compartamos", logo: "/banks/130.png" },
    "132": { name: "Multiva", logo: "/banks/132.png" },
    "133": { name: "Actinver", logo: "/banks/133.png" },
    "136": { name: "Intercam", logo: "/banks/136.png" },
    "137": { name: "BanCoppel", logo: "/banks/137.png" },
    "140": { name: "Consubanco", logo: "/banks/140.png" },
    "143": { name: "CIBanco", logo: "/banks/143.png" },
    "145": { name: "Banco Base", logo: "/banks/145.png" },
    "147": { name: "Bankaool", logo: "/banks/147.png" },
    "148": { name: "PagaTodo", logo: "/banks/148.png" },
    "152": { name: "Bancrea", logo: "/banks/152.png" },
    "156": { name: "Sabadell", logo: "/banks/156.png" },
    "166": { name: "Banco del Bienestar", logo: null },
    "638": { name: "Nu México", logo: "/banks/638.png" },
    "646": { name: "STP", logo: "/banks/646.png" },
    "722": { name: "Mercado Pago", logo: "/banks/722.png" },
    "728": { name: "Spin by OXXO", logo: "/banks/728.png" },
  }),
);

export function bankFromClabe(clabe: string): MexicanBank | null {
  const code = clabe.replace(/\D/g, "").slice(0, 3);
  const bank = BANKS.get(code);
  return bank ? { code, ...bank } : null;
}

export const MEXICAN_BANK_CODES = [...BANKS.keys()];
