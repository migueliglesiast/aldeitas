import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import build from '../build.js';

const {
  normalizeBasePath,
  slugify,
  isImageFile,
  htmlEscape,
  listSuiteDirectories,
  makeIndexHtml,
  makeListingHtml,
} = build;

describe('normalizeBasePath', () => {
  it('returns root for empty or root input', () => {
    expect(normalizeBasePath('')).toBe('/');
    expect(normalizeBasePath(undefined)).toBe('/');
    expect(normalizeBasePath('/')).toBe('/');
  });

  it('adds leading and trailing slashes', () => {
    expect(normalizeBasePath('aldeitas')).toBe('/aldeitas/');
    expect(normalizeBasePath('/aldeitas')).toBe('/aldeitas/');
    expect(normalizeBasePath(' /aldeitas/ ')).toBe('/aldeitas/');
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Casa Yahua - Suite 1')).toBe('casa-yahua---suite-1');
  });

  it('drops characters that are not alphanumeric, space or hyphen', () => {
    expect(slugify('Suite #3 (Deluxe)')).toBe('suite-3-deluxe');
  });
});

describe('isImageFile', () => {
  it.each(['a.jpg', 'a.JPEG', 'a.png', 'a.webp', 'a.avif'])('accepts %s', name => {
    expect(isImageFile(name)).toBe(true);
  });

  it.each(['a.txt', 'a.jpg.txt', 'README.md', '.DS_Store'])('rejects %s', name => {
    expect(isImageFile(name)).toBe(false);
  });
});

describe('htmlEscape', () => {
  it('escapes html-significant characters', () => {
    expect(htmlEscape(`<img src="x" onerror='alert(1)'>&`)).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;'
    );
  });
});

describe('listSuiteDirectories', () => {
  let root;

  beforeAll(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'yahua-build-'));
    await fs.promises.mkdir(path.join(root, 'Casa Yahua - Suite 2'));
    await fs.promises.writeFile(path.join(root, 'Casa Yahua - Suite 2', 'b.jpg'), 'x');
    await fs.promises.mkdir(path.join(root, 'Casa Yahua - Suite 1'));
    await fs.promises.writeFile(path.join(root, 'Casa Yahua - Suite 1', 'a.png'), 'x');
    await fs.promises.writeFile(path.join(root, 'Casa Yahua - Suite 1', 'notes.txt'), 'x');
    await fs.promises.mkdir(path.join(root, 'Casa Yahua - Empty'));
    await fs.promises.mkdir(path.join(root, 'Other Hotel - Suite 1'));
    await fs.promises.writeFile(path.join(root, 'Other Hotel - Suite 1', 'c.jpg'), 'x');
  });

  afterAll(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  it('returns only matching, non-empty suite folders sorted by name', async () => {
    const suites = await listSuiteDirectories(root);
    expect(suites.map(s => s.name)).toEqual(['Casa Yahua - Suite 1', 'Casa Yahua - Suite 2']);
    expect(suites[0].slug).toBe('casa-yahua---suite-1');
    expect(suites[0].images.map(i => i.fileName)).toEqual(['a.png']);
  });
});

describe('html generation', () => {
  const suite = {
    name: 'Casa Yahua - <Suite 1>',
    slug: 'casa-yahua---suite-1',
    images: [{ fileName: 'a photo.jpg' }],
  };

  it('escapes suite names in the index page and encodes image paths', () => {
    const html = makeIndexHtml([suite]);
    expect(html).toContain('Casa Yahua - &lt;Suite 1&gt;');
    expect(html).not.toContain('<Suite 1>');
    expect(html).toContain('a%20photo.jpg');
  });

  it('escapes suite names in listing pages and wires the availability slug', () => {
    const html = makeListingHtml(suite);
    expect(html).toContain('data-slug="casa-yahua---suite-1"');
    expect(html).toContain('Casa Yahua - &lt;Suite 1&gt;');
    expect(html).not.toContain('<Suite 1>');
  });
});
