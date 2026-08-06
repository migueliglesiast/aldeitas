import { describe, it, expect } from 'vitest';
import syncIcal from '../sync-ical.js';

const { fetchIcs, parseDateFromLine, enumerateDates, parseIcsToBookedDates } = syncIcal;

describe('parseDateFromLine', () => {
  it('parses date-only and datetime forms', () => {
    expect(parseDateFromLine('DTSTART;VALUE=DATE:20250101')).toBe('2025-01-01');
    expect(parseDateFromLine('DTSTART:20250101')).toBe('2025-01-01');
    expect(parseDateFromLine('DTEND:20250103T150000Z')).toBe('2025-01-03');
  });

  it('returns null when no date is present', () => {
    expect(parseDateFromLine('SUMMARY:Reserved')).toBeNull();
    expect(parseDateFromLine('')).toBeNull();
  });
});

describe('enumerateDates', () => {
  it('enumerates days with an exclusive end', () => {
    expect(enumerateDates('2025-01-01', '2025-01-04')).toEqual([
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
    ]);
  });

  it('returns an empty list when the range is empty', () => {
    expect(enumerateDates('2025-01-01', '2025-01-01')).toEqual([]);
  });
});

describe('parseIcsToBookedDates', () => {
  it('expands VEVENT ranges into sorted unique days', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20250110',
      'DTEND;VALUE=DATE:20250112',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20250101',
      'DTEND;VALUE=DATE:20250102',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    expect(parseIcsToBookedDates(ics)).toEqual(['2025-01-01', '2025-01-10', '2025-01-11']);
  });

  it('treats an event without DTEND as a single day', () => {
    const ics = 'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20250505\r\nEND:VEVENT';
    expect(parseIcsToBookedDates(ics)).toEqual(['2025-05-05']);
  });

  it('skips events without a parseable DTSTART and calendars without events', () => {
    expect(parseIcsToBookedDates('BEGIN:VEVENT\r\nSUMMARY:x\r\nEND:VEVENT')).toEqual([]);
    expect(parseIcsToBookedDates('BEGIN:VCALENDAR\r\nEND:VCALENDAR')).toEqual([]);
  });
});

describe('fetchIcs', () => {
  it.each([
    'http://www.airbnb.com/x.ics',
    'https://169.254.169.254/latest/meta-data',
    'https://evil.com/x.ics',
  ])('refuses to fetch %s', url => {
    expect(() => fetchIcs(url)).toThrow();
  });
});
