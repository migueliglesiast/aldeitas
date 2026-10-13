// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectEmergencyByKeywords } from "@/lib/whatsapp/agent";
import { bestKeywordMatch } from "@/lib/whatsapp/answers";
import { parseInboundMessages, verifyWhatsappSignature } from "@/lib/whatsapp/cloud-api";
import { detectLocale, t } from "@/lib/whatsapp/copy";
import { canonicalPhone, samePhone } from "@/lib/whatsapp/phone";
import { parseProvidersCsv } from "@/lib/whatsapp/providers-sheet";
import { extractRoomCode, findListingIdByRoomCode, roomCode } from "@/lib/whatsapp/room-code";
import { localDateAndHour } from "@/lib/whatsapp/stay-messages";

afterEach(() => vi.unstubAllEnvs());

describe("phones", () => {
  it("folds Mexico's 521 mobile prefix and 10-digit local numbers", () => {
    expect(canonicalPhone("5219541411121")).toBe("529541411121");
    expect(canonicalPhone("954 141 1121")).toBe("529541411121");
    expect(canonicalPhone("+1 (415) 555-0100")).toBe("14155550100");
    expect(samePhone("+52 954 141 1121", "5219541411121")).toBe(true);
    expect(samePhone("954141", "954141")).toBe(false);
  });
});

describe("providers sheet", () => {
  const csv = [
    "Servicio,Huesped/Cliente,prioridad,Nombre de persona,LADA,numero,CLABE,Notas",
    "Plomería,C,1,Lucho,52,984 213 6293,,",
    ",C,6,Chino Bojorquez,52,954 146 2348,,ultimo recurso",
    ",C,2,Felix,52,954 184 6657,,",
    ",,,,,,,",
    "Taxi,H,1,Oscar,52,954 138 4919,,",
    '"Oscar Jr. ",H,x,Bad,52,1,,',
  ].join("\n");

  it("carries the service down and builds full phone numbers", () => {
    const rows = parseProvidersCsv(csv);
    expect(rows).toEqual([
      { service: "Plomería", audience: "C", priority: 1, name: "Lucho", phone: "529842136293", notes: null },
      { service: "Plomería", audience: "C", priority: 6, name: "Chino Bojorquez", phone: "529541462348", notes: "ultimo recurso" },
      { service: "Plomería", audience: "C", priority: 2, name: "Felix", phone: "529541846657", notes: null },
      { service: "Taxi", audience: "H", priority: 1, name: "Oscar", phone: "529541384919", notes: null },
    ]);
  });
});

describe("room codes", () => {
  it("is stable per listing and found in a QR message", () => {
    vi.stubEnv("WHATSAPP_ROOM_CODE_SECRET", "s");
    const code = roomCode("listing-a");
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(roomCode("listing-a")).toBe(code);
    expect(extractRoomCode(`Hola, estoy en Balcón · código ${code}`)).toBe(code);
    expect(extractRoomCode(`hi, code: ${code.toLowerCase()}`)).toBe(code);
    expect(findListingIdByRoomCode(code, ["listing-b", "listing-a"])).toBe("listing-a");
  });
});

describe("webhook parsing", () => {
  it("verifies Meta's sha256 signature", () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "app-secret");
    const body = '{"a":1}';
    const sig = `sha256=${createHmac("sha256", "app-secret").update(body).digest("hex")}`;
    expect(verifyWhatsappSignature(body, sig)).toBe(true);
    expect(verifyWhatsappSignature(body + " ", sig)).toBe(false);
    expect(verifyWhatsappSignature(body, null)).toBe(false);
  });

  it("extracts text, button replies and quoted context", () => {
    const messages = parseInboundMessages({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "5219541411121", profile: { name: "Ana" } }],
                messages: [
                  { id: "m1", from: "5219541411121", type: "text", text: { body: "Hola" }, context: { id: "q1" } },
                  { id: "m2", from: "529541846657", type: "button", button: { payload: "em:accept:d1", text: "Voy en camino" } },
                  { id: "m3", from: "529541846657", type: "interactive", interactive: { button_reply: { id: "save:t1", title: "Guardar" } } },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(messages).toEqual([
      { id: "m1", from: "5219541411121", profileName: "Ana", text: "Hola", buttonId: null, contextId: "q1" },
      { id: "m2", from: "529541846657", profileName: null, text: "Voy en camino", buttonId: "em:accept:d1", contextId: null },
      { id: "m3", from: "529541846657", profileName: null, text: "Guardar", buttonId: "save:t1", contextId: null },
    ]);
  });
});

describe("rule-based fallbacks", () => {
  it("detects plumbing and electrical emergencies", () => {
    expect(detectEmergencyByKeywords("Hay una fuga en el baño")).toBe("plumbing");
    expect(detectEmergencyByKeywords("se fue la luz en el cuarto")).toBe("electrical");
    expect(detectEmergencyByKeywords("¿A qué hora es el checkout?")).toBeNull();
  });

  it("matches the WiFi answer by keywords", () => {
    const base = { hotelId: "h", listingId: null, verifiedOnly: true, createdAt: new Date(), updatedAt: new Date() };
    const answers = [
      { ...base, id: "1", question: "Contraseña del WiFi", answer: "mar2024" },
      { ...base, id: "2", question: "Hora de salida", answer: "12:00", verifiedOnly: false },
    ];
    expect(bestKeywordMatch("cual es el password del internet?", answers)?.id).toBe("1");
    expect(bestKeywordMatch("¿hay tours a la laguna?", answers)).toBeNull();
  });

  it("detects the guest's language and fills copy", () => {
    expect(detectLocale("Hi, what is the wifi password?", "es")).toBe("en");
    expect(detectLocale("Hola, ¿dónde está la playa?", "en")).toBe("es");
    expect(t("goodbye", "es", { hotel: "Aldeita Mixteca" })).toContain("tu estancia en Aldeita Mixteca");
  });

  it("uses Mexico City local time for stay messages", () => {
    expect(localDateAndHour(new Date("2026-10-05T03:30:00Z"))).toEqual({ date: "2026-10-04", hour: 21 });
  });
});
