import { describe, expect, it } from "vitest";
import { parseAirbnbBookingEmail } from "@/lib/parse-airbnb-email";

const text = `¡NUEVA RESERVACIÓN CONFIRMADA! ANA LLEGA EL 23 NOV.
https://www.airbnb.mx/rooms/44104078
Casa/depto. entero
Llegada         Salida
lun 23 de nov   vie 27 de nov
HUÉSPEDES
1 adulto
CÓDIGO DE CONFIRMACIÓN
HMTEST1234
TOTAL (MXN)   $7,407.43
PAGO AL ANFITRIÓN
Tarifa de la habitación por 4 noches   $5,900.00
GANAS   $6,090.97`;

describe("parseAirbnbBookingEmail (Mexican Spanish)", () => {
  it("parses 'Reservación confirmada' emails with the GANAS payout", () => {
    const p = parseAirbnbBookingEmail({
      subject: "Reservación confirmada - Ana Pérez llega el 23 nov.",
      text,
      referenceDate: new Date("2026-11-15T12:00:00Z"),
    });
    expect(p).toMatchObject({
      guestName: "Ana Pérez",
      checkIn: "2026-11-23",
      checkOut: "2026-11-27",
      confirmationCode: "HMTEST1234",
      payoutCents: 609097,
      payoutCurrency: "MXN",
    });
  });
});
