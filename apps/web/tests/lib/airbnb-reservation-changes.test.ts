import { describe, it, expect } from "vitest";
import {
  findAlteredStay,
  findCanceledStay,
  parseReservationChangeEmail,
  reservationChangeKind,
  type ChangeMetaRow,
} from "@/lib/airbnb-reservation-changes";
import { parseDateKey, toDateKey } from "@/lib/calendar-dates";

function meta(partial: Partial<ChangeMetaRow> & { id: string; startDate: Date; endDate: Date }) {
  return {
    listingId: "l1",
    guestName: null,
    confirmationCode: null,
    canceledAt: null,
    ...partial,
  } satisfies ChangeMetaRow;
}

describe("reservationChangeKind", () => {
  it("detects Airbnb cancellation and alteration subjects in English and Spanish", () => {
    expect(reservationChangeKind("Reservation HM4ABC123 canceled")).toBe("canceled");
    expect(reservationChangeKind("Canceled: Reservation HMXYZ for Mar 3 – 6")).toBe("canceled");
    expect(reservationChangeKind("Reserva cancelada - Lauren llegaba el 29 oct")).toBe("canceled");
    expect(reservationChangeKind("Reservation altered: Lauren arrives Oct 30")).toBe("altered");
    expect(reservationChangeKind("Alteración de la reserva de Lauren")).toBe("altered");
    expect(reservationChangeKind("Your reservation change was accepted")).toBe("altered");
    expect(reservationChangeKind("Reservation HM3MWFT95H has been canceled")).toBe("canceled");
  });

  it("ignores confirmations and pending change or cancellation requests", () => {
    expect(reservationChangeKind("Reservation confirmed - Lauren arrives Oct 29")).toBeNull();
    expect(reservationChangeKind("Reservation alteration request from Lauren")).toBeNull();
    expect(reservationChangeKind("Fernanda wants to change their reservation")).toBeNull();
    expect(reservationChangeKind("Michael quiere hacer un cambio en su reservación")).toBeNull();
    expect(reservationChangeKind("Solicitud de cancelación de Lauren")).toBeNull();
    expect(reservationChangeKind("Updates to our cancellation policy")).toBeNull();
  });
});

describe("parseReservationChangeEmail", () => {
  it("reads Airbnb's current cancellation email (code + dates in subject, year in body)", () => {
    const parsed = parseReservationChangeEmail({
      subject: "Canceled: Reservation HMZQMSCB5Q for May 28 – 30",
      text: "These dates are now open for other guests\nRESERVATION CANCELED\nZicatela Oceanview among the trees",
      html: "<p>May 28 – 30, 5 guests</p><p>Unfortunately, your guest Gutierrez Araujo had to cancel reservation HMZQMSCB5Q.</p><p>May 28 – 30, 2027. Your calendar has been updated</p>",
      referenceDate: new Date("2026-10-21T16:48:12Z"),
    });
    expect(parsed).toMatchObject({
      kind: "canceled",
      confirmationCode: "HMZQMSCB5Q",
      guestName: "Gutierrez Araujo",
    });
    expect(toDateKey(parsed!.checkIn!)).toBe("2027-05-28");
    expect(toDateKey(parsed!.checkOut!)).toBe("2027-05-30");
  });

  it("infers the year for a subject-only range and reads the Spanish format", () => {
    const en = parseReservationChangeEmail({
      subject: "Canceled: Reservation HMY5TWJMPM for December 6 – 12",
      referenceDate: new Date("2026-09-15T17:15:52Z"),
    });
    expect(toDateKey(en!.checkIn!)).toBe("2026-12-06");
    const es = parseReservationChangeEmail({
      subject: "Reservación cancelada - 6 nov.-10 nov., en Lovely studio",
      text: "Desafortunadamente, tu huésped Pierre tuvo que cancelar la reservación HMQYHQDBNN.\nAnuncio número 53796520\n6 nov.-10 nov., 2 huéspedes",
      referenceDate: new Date("2022-10-22T20:50:31Z"),
    });
    expect(es).toMatchObject({ confirmationCode: "HMQYHQDBNN", guestName: "Pierre", airbnbListingId: "53796520" });
    expect(toDateKey(es!.checkIn!)).toBe("2022-11-06");
    expect(toDateKey(es!.checkOut!)).toBe("2022-11-10");
  });

  it("reads the accepted-change email, which has a code but no dates", () => {
    const parsed = parseReservationChangeEmail({
      subject: "Your reservation change was accepted",
      text: "ANDREA AGREED TO CHANGE THEIR RESERVATION\nAndrea\nMexico City, Mexico\nWe’ve already updated the reservation itinerary.",
      html: '<a href="https://www.airbnb.com/hosting/reservations/details/HMCPWPBAHS">Go to itinerary</a>',
    });
    expect(parsed).toMatchObject({
      kind: "altered",
      confirmationCode: "HMCPWPBAHS",
      guestName: "Andrea",
      checkIn: null,
    });
  });
});

describe("matching change emails to saved stays", () => {
  const oct29 = parseDateKey("2026-10-29");
  const nov1 = parseDateKey("2026-11-01");
  const rows = [
    meta({ id: "a", startDate: oct29, endDate: nov1, guestName: "Lauren Quinones", confirmationCode: "HM4ABC1234" }),
    meta({ id: "b", startDate: parseDateKey("2026-11-05"), endDate: parseDateKey("2026-11-08"), guestName: "Christine Dixon" }),
  ];

  it("cancels by confirmation code, by guest name plus check-in, or by unique exact dates", () => {
    expect(findCanceledStay(rows, { confirmationCode: "hm4abc1234", guestName: null, checkIn: null })?.id).toBe("a");
    expect(
      findCanceledStay(rows, { confirmationCode: null, guestName: "Christine", checkIn: parseDateKey("2026-11-05") })?.id
    ).toBe("b");
    expect(
      findCanceledStay(rows, { confirmationCode: "HMNEWCODE1", guestName: null, checkIn: parseDateKey("2026-11-05"), checkOut: parseDateKey("2026-11-08") })?.id
    ).toBe("b");
  });

  it("does not cancel on check-in alone, ambiguous dates or a different guest", () => {
    expect(findCanceledStay(rows, { confirmationCode: null, guestName: null, checkIn: oct29 })).toBeNull();
    const twin = meta({ id: "c", listingId: "l2", startDate: oct29, endDate: nov1 });
    expect(
      findCanceledStay([...rows.map((r) => ({ ...r, confirmationCode: null })), twin], { confirmationCode: null, guestName: null, checkIn: oct29, checkOut: nov1 })
    ).toBeNull();
    expect(findCanceledStay(rows, { confirmationCode: null, guestName: "Sara", checkIn: oct29 })).toBeNull();
    expect(
      findCanceledStay([{ ...rows[0], canceledAt: new Date() }], { confirmationCode: "HM4ABC1234", guestName: null, checkIn: null })
    ).toBeNull();
  });

  it("finds the stay an alteration moves, even when the new dates don't overlap", () => {
    const moved = findAlteredStay(rows, {
      confirmationCode: "HM4ABC1234",
      guestName: "Lauren",
      checkIn: parseDateKey("2026-11-20"),
      listingId: "l1",
    });
    expect(moved?.id).toBe("a");
    expect(
      findAlteredStay(rows, { confirmationCode: "HMOTHER123", guestName: "Lauren", checkIn: oct29, listingId: "l1" })
    ).toBeNull();
    expect(
      findAlteredStay(rows, { confirmationCode: "HM4ABC1234", guestName: null, checkIn: oct29, listingId: "l2" })
    ).toBeNull();
  });
});
