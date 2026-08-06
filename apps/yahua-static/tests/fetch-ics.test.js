import { EventEmitter } from 'node:events';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const getMock = vi.fn();

import syncIcal from '../sync-ical.js';

const fetchIcs = url => syncIcal.fetchIcs(url, { httpGet: getMock });

const URL_OK = 'https://www.airbnb.com/calendar/ical/1.ics';

function makeResponse({ statusCode = 200, headers = {}, chunks = [] } = {}) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  res.headers = headers;
  res.setEncoding = () => {};
  res.resume = () => {};
  res.emitAll = () => {
    for (const chunk of chunks) res.emit('data', chunk);
    res.emit('end');
  };
  return res;
}

function respondWith(response) {
  getMock.mockImplementationOnce((url, options, cb) => {
    const req = new EventEmitter();
    req.destroy = vi.fn();
    setTimeout(() => {
      cb(response);
      response.emitAll();
    }, 0);
    return req;
  });
}

describe('fetchIcs', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('resolves with the response body', async () => {
    respondWith(makeResponse({ chunks: ['BEGIN:VCALENDAR\r\n', 'END:VCALENDAR'] }));

    await expect(fetchIcs(URL_OK)).resolves.toBe('BEGIN:VCALENDAR\r\nEND:VCALENDAR');
  });

  it('follows redirects and revalidates the redirect target', async () => {
    respondWith(
      makeResponse({
        statusCode: 302,
        headers: { location: 'https://calendar.airbnb.com/final.ics' },
      })
    );
    respondWith(makeResponse({ chunks: ['OK'] }));

    await expect(fetchIcs(URL_OK)).resolves.toBe('OK');
    expect(getMock.mock.calls[1][0]).toBe('https://calendar.airbnb.com/final.ics');
  });

  it('rejects a redirect pointing outside the allowlist', async () => {
    respondWith(
      makeResponse({ statusCode: 302, headers: { location: 'https://169.254.169.254/meta' } })
    );

    await expect(fetchIcs(URL_OK)).rejects.toThrow(/not allowed/);
  });

  it('rejects when the redirect chain is too long', async () => {
    for (let i = 0; i < 5; i++) {
      respondWith(
        makeResponse({ statusCode: 302, headers: { location: 'https://www.airbnb.com/next.ics' } })
      );
    }

    await expect(fetchIcs(URL_OK)).rejects.toThrow(/Too many redirects/);
  });

  it('rejects non-200 responses', async () => {
    respondWith(makeResponse({ statusCode: 500 }));

    await expect(fetchIcs(URL_OK)).rejects.toThrow(/Failed to fetch ICS: 500/);
  });

  it('rejects responses larger than the size limit', async () => {
    respondWith(makeResponse({ chunks: ['x'.repeat(6 * 1024 * 1024)] }));

    await expect(fetchIcs(URL_OK)).rejects.toThrow(/too large/);
  });

  it('rejects transport errors', async () => {
    getMock.mockImplementationOnce(() => {
      const req = new EventEmitter();
      req.destroy = vi.fn();
      setTimeout(() => req.emit('error', new Error('socket hang up')), 0);
      return req;
    });

    await expect(fetchIcs(URL_OK)).rejects.toThrow('socket hang up');
  });

  it('destroys the request on timeout', async () => {
    let timedOutReq;
    getMock.mockImplementationOnce(() => {
      timedOutReq = new EventEmitter();
      timedOutReq.destroy = vi.fn(err => timedOutReq.emit('error', err));
      setTimeout(() => timedOutReq.emit('timeout'), 0);
      return timedOutReq;
    });

    await expect(fetchIcs(URL_OK)).rejects.toThrow('ICS request timed out');
    expect(timedOutReq.destroy).toHaveBeenCalled();
  });
});
