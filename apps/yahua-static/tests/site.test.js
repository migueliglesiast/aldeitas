// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

async function loadSite() {
  vi.resetModules();
  await import('../assets/site.js');
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('availability widget', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<meta name="base-path" content="/" /><div id="availability" data-slug="suite-1"></div>';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a calendar with booked days marked', async () => {
    const today = new Date();
    const booked = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bookedDates: [booked] }) })
    );

    await loadSite();

    const container = document.getElementById('availability');
    expect(container.querySelectorAll('.month')).toHaveLength(6);
    expect(container.querySelectorAll('.day.booked')).toHaveLength(1);
    expect(container.querySelectorAll('.day.today')).toHaveLength(1);
  });

  it('ignores non-date entries instead of injecting them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ bookedDates: ['<img src=x onerror=alert(1)>'] }),
      })
    );

    await loadSite();

    const container = document.getElementById('availability');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelectorAll('.day.booked')).toHaveLength(0);
  });

  it('shows a placeholder built from text nodes when there is no availability', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bookedDates: [] }) })
    );

    await loadSite();

    const placeholder = document.querySelector('#availability .placeholder');
    expect(placeholder.textContent).toContain('No availability loaded yet.');
    expect(placeholder.querySelectorAll('code')).toHaveLength(2);
  });

  it('shows a placeholder when the availability payload is not an array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bookedDates: 'nope' }) })
    );

    await loadSite();

    expect(document.querySelector('#availability .placeholder').textContent).toContain(
      'No availability loaded yet.'
    );
  });

  it('shows a placeholder when the availability request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await loadSite();

    expect(document.querySelector('#availability .placeholder').textContent).toContain(
      'Availability not found.'
    );
  });

  it('falls back to the root base path when the meta tag is absent', async () => {
    document.body.innerHTML = '<div id="availability" data-slug="suite-1"></div>';
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ bookedDates: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    await loadSite();

    expect(fetchMock).toHaveBeenCalledWith('/availability/suite-1.json', { cache: 'no-store' });
  });

  it('does nothing when the slug is missing', async () => {
    document.body.innerHTML = '<div id="availability"></div>';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await loadSite();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when the container is missing', async () => {
    document.body.innerHTML = '';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await loadSite();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
