import { describe, it, expect } from 'vitest';
import safeUrl from '../lib/safe-url.js';

const { assertSafeUrl, isSafeUrl } = safeUrl;

describe('assertSafeUrl', () => {
  it('accepts allowlisted hosts and subdomains over https', () => {
    expect(assertSafeUrl('https://www.airbnb.com/calendar/ical/1.ics').hostname).toBe(
      'www.airbnb.com'
    );
    expect(isSafeUrl('https://booking.com/x.ics')).toBe(true);
    expect(isSafeUrl('https://app.guesty.com/x.ics')).toBe(true);
  });

  it('rejects non-https schemes', () => {
    expect(() => assertSafeUrl('http://www.airbnb.com/x.ics')).toThrow(/https/);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it.each([
    'https://127.0.0.1/x.ics',
    'https://10.0.0.5/x.ics',
    'https://172.16.4.1/x.ics',
    'https://192.168.1.1/x.ics',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/x.ics',
    'https://localhost/x.ics',
    'https://metadata.google.internal/x',
  ])('rejects internal target %s', url => {
    expect(isSafeUrl(url)).toBe(false);
  });

  it('rejects hosts outside the allowlist and lookalike domains', () => {
    expect(isSafeUrl('https://evil.com/x.ics')).toBe(false);
    expect(isSafeUrl('https://airbnb.com.evil.com/x.ics')).toBe(false);
  });

  it('does not mistake domain names starting with IPv6 prefixes for private addresses', () => {
    expect(isSafeUrl('https://fd-cal.guesty.com/x.ics')).toBe(true);
    expect(isSafeUrl('https://fe80cdn.airbnb.com/x.ics')).toBe(true);
    expect(isSafeUrl('https://[fd00::1]/x.ics')).toBe(false);
  });

  it('extends the allowlist with ICAL_ALLOWED_HOSTS', () => {
    expect(isSafeUrl('https://app.lodgify.com/x.ics')).toBe(false);
    process.env.ICAL_ALLOWED_HOSTS = 'lodgify.com';
    try {
      expect(isSafeUrl('https://app.lodgify.com/x.ics')).toBe(true);
      expect(isSafeUrl('https://evil.com/x.ics')).toBe(false);
    } finally {
      delete process.env.ICAL_ALLOWED_HOSTS;
    }
  });

  it('rejects credentials embedded in the URL and malformed URLs', () => {
    expect(isSafeUrl('https://user:pass@www.airbnb.com/x.ics')).toBe(false);
    expect(() => assertSafeUrl('not a url')).toThrow(/Invalid URL/);
  });
});
