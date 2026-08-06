import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import build from '../build.js';
import syncIcal from '../sync-ical.js';

const APP_ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');

describe('build main', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('regenerates the public/ output from the suite folders', async () => {
    await build.main();

    const index = await fs.promises.readFile(path.join(APP_ROOT, 'public', 'index.html'), 'utf8');
    expect(index).toContain('Welcome to Casa Yahua');

    const suites = await build.listSuiteDirectories();
    for (const suite of suites) {
      const listing = path.join(APP_ROOT, 'public', 'listings', suite.slug, 'index.html');
      expect(fs.existsSync(listing)).toBe(true);
      expect(fs.existsSync(path.join(APP_ROOT, 'public', 'availability', `${suite.slug}.json`))).toBe(
        true
      );
    }
    expect(fs.existsSync(path.join(APP_ROOT, 'public', 'assets', 'site.js'))).toBe(true);
  });
});

describe('sync-ical main', () => {
  let workdir;

  beforeEach(async () => {
    workdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'yahua-sync-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.promises.rm(workdir, { recursive: true, force: true });
  });

  async function writeConfig(config) {
    const configPath = path.join(workdir, 'config.json');
    await fs.promises.writeFile(configPath, JSON.stringify(config), 'utf8');
    return configPath;
  }

  it('writes availability files for suites with an iCal URL and skips the rest', async () => {
    const configPath = await writeConfig({
      'suite-1': { name: 'Suite 1', icalUrl: 'https://www.airbnb.com/calendar/ical/1.ics' },
      'suite-2': { name: 'Suite 2', icalUrl: '' },
    });
    const fetcher = vi
      .fn()
      .mockResolvedValue('BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20250101\r\nDTEND;VALUE=DATE:20250103\r\nEND:VEVENT');

    await syncIcal.main({ configPath, outDir: workdir, fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const written = JSON.parse(await fs.promises.readFile(path.join(workdir, 'suite-1.json'), 'utf8'));
    expect(written.bookedDates).toEqual(['2025-01-01', '2025-01-02']);
    expect(fs.existsSync(path.join(workdir, 'suite-2.json'))).toBe(false);
  });

  it('keeps going when a calendar cannot be fetched', async () => {
    const configPath = await writeConfig({
      'suite-1': { name: 'Suite 1', icalUrl: 'https://www.airbnb.com/calendar/ical/1.ics' },
    });
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(syncIcal.main({ configPath, outDir: workdir, fetcher })).resolves.toBeUndefined();
    expect(fs.existsSync(path.join(workdir, 'suite-1.json'))).toBe(false);
  });

  it('returns early for an empty config', async () => {
    const configPath = await writeConfig({});
    const fetcher = vi.fn();

    await syncIcal.main({ configPath, outDir: workdir, fetcher });

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('exits when the config file is missing', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exited');
    });

    await expect(
      syncIcal.main({ configPath: path.join(workdir, 'missing.json'), outDir: workdir })
    ).rejects.toThrow('exited');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
