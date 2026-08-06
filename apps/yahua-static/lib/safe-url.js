'use strict';

/**
 * Guards outbound requests against SSRF: only https URLs pointing at an
 * explicit allowlist of booking-platform domains are accepted.
 */

const ALLOWED_HOSTS = ['airbnb.com', 'guesty.com', 'booking.com'];

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10000;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
]);

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map(Number);
  if (octets.some(o => !Number.isInteger(o) || o < 0 || o > 255)) return false;
  const [a, b] = octets;
  if (a === 0 || a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === '::1' || host === '::') return true;
  if (host.startsWith('fc') || host.startsWith('fd')) return true;
  if (host.startsWith('fe80')) return true;
  if (host.startsWith('::ffff:')) return isPrivateIpv4(host.slice('::ffff:'.length));
  return false;
}

function isAllowedHost(hostname) {
  return ALLOWED_HOSTS.some(allowed => hostname === allowed || hostname.endsWith(`.${allowed}`));
}

function assertSafeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Only https URLs are allowed');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error('Host is not allowed');
  }
  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    throw new Error('Host is not allowed');
  }
  if (url.username || url.password) {
    throw new Error('Credentials in URL are not allowed');
  }
  if (!isAllowedHost(hostname)) {
    throw new Error('Host is not in the allowlist');
  }

  return url;
}

function isSafeUrl(rawUrl) {
  try {
    assertSafeUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  ALLOWED_HOSTS,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
  assertSafeUrl,
  isSafeUrl,
};
