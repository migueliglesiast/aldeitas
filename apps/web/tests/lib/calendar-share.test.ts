import { describe, expect, it } from "vitest";
import {
  calendarAccessCookieValue,
  getHotelCalendarShareUrl,
  hasCalendarAccess,
  slugifyCalendarName,
} from "@/lib/calendar-share";

describe("calendar share helpers", () => {
  it("builds compact slugs from hotel names", () => {
    expect(slugifyCalendarName("La Otra Aldeita")).toBe("laotraaldeita");
    expect(slugifyCalendarName("Casa Yahuá #2")).toBe("casayahua2");
  });

  it("builds readable admin calendar URLs", () => {
    expect(getHotelCalendarShareUrl("arbolita")).toMatch(/\/arbolita\/admincalendar$/);
  });

  it("accepts only the cookie signed for the current PIN", () => {
    const share = { id: "s1", token: "secret-token", pinHash: "hash-a" };
    const cookie = calendarAccessCookieValue(share);
    expect(hasCalendarAccess(share, cookie)).toBe(true);
    expect(hasCalendarAccess({ ...share, pinHash: "hash-b" }, cookie)).toBe(false);
    expect(hasCalendarAccess(share, undefined)).toBe(false);
    expect(hasCalendarAccess(share, "nope")).toBe(false);
  });
});
