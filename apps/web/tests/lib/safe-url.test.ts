import { describe, it, expect, afterEach } from "vitest";
import { assertSafeUrl, isSafeUrl, ALLOWED_HOSTS } from "@/lib/safe-url";

describe("assertSafeUrl", () => {
  it("accepts allowlisted hosts and their subdomains over https", () => {
    expect(assertSafeUrl("https://www.airbnb.com/calendar/ical/1.ics").hostname).toBe(
      "www.airbnb.com"
    );
    for (const host of ALLOWED_HOSTS) {
      expect(isSafeUrl(`https://${host}/x.ics`)).toBe(true);
      expect(isSafeUrl(`https://sub.${host}/x.ics`)).toBe(true);
    }
  });

  it("rejects non-https schemes", () => {
    expect(() => assertSafeUrl("http://www.airbnb.com/x.ics")).toThrow(/https/);
    expect(isSafeUrl("ftp://www.airbnb.com/x.ics")).toBe(false);
  });

  it.each([
    "https://127.0.0.1/x",
    "https://0.0.0.0/x",
    "https://10.1.2.3/x",
    "https://172.16.0.1/x",
    "https://192.168.0.1/x",
    "https://169.254.169.254/latest/meta-data",
    "https://100.64.0.1/x",
    "https://239.0.0.1/x",
    "https://[::1]/x",
    "https://[fd00::1]/x",
    "https://[fe80::1]/x",
    "https://[::ffff:127.0.0.1]/x",
    "https://localhost/x",
    "https://metadata.google.internal/x",
  ])("rejects internal target %s", (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });

  it("rejects hosts outside the allowlist, including lookalikes", () => {
    expect(isSafeUrl("https://evil.com/x")).toBe(false);
    expect(isSafeUrl("https://airbnb.com.evil.com/x")).toBe(false);
    expect(isSafeUrl("https://notairbnb.com/x")).toBe(false);
  });

  it("rejects embedded credentials and malformed URLs", () => {
    expect(isSafeUrl("https://user:pass@www.airbnb.com/x")).toBe(false);
    expect(isSafeUrl("https://user@www.airbnb.com/x")).toBe(false);
    expect(() => assertSafeUrl("nope")).toThrow(/Invalid URL/);
  });

  it("normalizes a trailing dot in the hostname", () => {
    expect(isSafeUrl("https://www.airbnb.com./x")).toBe(true);
  });
});

describe("ICAL_ALLOWED_HOSTS", () => {
  afterEach(() => {
    delete process.env.ICAL_ALLOWED_HOSTS;
  });

  it("extends the allowlist with extra providers and their subdomains", () => {
    expect(isSafeUrl("https://app.lodgify.com/x.ics")).toBe(false);

    process.env.ICAL_ALLOWED_HOSTS = " lodgify.com , Hostaway.com ";

    expect(isSafeUrl("https://app.lodgify.com/x.ics")).toBe(true);
    expect(isSafeUrl("https://hostaway.com/x.ics")).toBe(true);
    expect(isSafeUrl("https://evil.com/x.ics")).toBe(false);
    expect(isSafeUrl("https://127.0.0.1/x.ics")).toBe(false);
  });
});
