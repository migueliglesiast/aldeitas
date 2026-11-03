import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatClabe, isValidClabe } from "@/lib/clabe";
import { MEXICAN_BANK_CODES, bankFromClabe } from "@/lib/mexican-banks";

describe("bankFromClabe", () => {
  it("recognizes the bank from the first 3 digits, even while typing", () => {
    expect(bankFromClabe("012")?.name).toBe("BBVA");
    expect(bankFromClabe("072 180")?.name).toBe("Banorte");
    expect(bankFromClabe("002010077777777771")).toMatchObject({
      code: "002",
      name: "Banamex",
      logo: "/banks/002.png",
    });
    expect(bankFromClabe("722969010000000000")?.name).toBe("Mercado Pago");
    expect(bankFromClabe("638180000100000000")?.name).toBe("Nu México");
  });

  it("returns null for unknown or incomplete codes", () => {
    expect(bankFromClabe("01")).toBeNull();
    expect(bankFromClabe("999123")).toBeNull();
  });

  it("ships a logo file for every bank that has one", () => {
    for (const code of MEXICAN_BANK_CODES) {
      const logo = bankFromClabe(code)?.logo;
      if (logo)
        expect(existsSync(path.join(process.cwd(), "public", logo)), logo).toBe(
          true,
        );
    }
  });
});

describe("formatClabe", () => {
  it("groups digits as bank, branch, account, check digit", () => {
    expect(formatClabe("002010077777777771")).toBe("002 010 07777777777 1");
    expect(formatClabe("0120")).toBe("012 0");
    expect(formatClabe("12-ab 3")).toBe("123");
    expect(
      isValidClabe(formatClabe("002010077777777771").replace(/\s/g, "")),
    ).toBe(true);
  });
});
