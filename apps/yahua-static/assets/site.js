(function() {
  function fmtYmd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function makePlaceholder(leadText) {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.appendChild(document.createTextNode(`${leadText} Add the Airbnb iCal URL in `));
    const configCode = document.createElement('code');
    configCode.textContent = 'data/config.json';
    placeholder.appendChild(configCode);
    placeholder.appendChild(document.createTextNode(' and run '));
    const commandCode = document.createElement('code');
    commandCode.textContent = 'npm run sync-calendars';
    placeholder.appendChild(commandCode);
    placeholder.appendChild(document.createTextNode('.'));
    return placeholder;
  }

  function renderCalendar(container, bookedDates, monthsToShow = 6) {
    const todayYmd = fmtYmd(new Date());

    const bookedSet = new Set(
      bookedDates.filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
    );
    const monthsWrapper = document.createElement('div');
    monthsWrapper.className = 'months';

    const start = new Date();
    start.setDate(1);

    for (let i = 0; i < monthsToShow; i++) {
      const monthDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const firstDow = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const monthEl = document.createElement('div');
      monthEl.className = 'month';

      const title = document.createElement('div');
      title.className = 'title';
      const monthName = monthDate.toLocaleString(undefined, { month: 'long' });
      title.textContent = `${monthName} ${year}`;
      monthEl.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'grid';

      const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (const dow of dows) {
        const el = document.createElement('div');
        el.className = 'dow';
        el.textContent = dow;
        grid.appendChild(el);
      }

      for (let e = 0; e < firstDow; e++) {
        const empty = document.createElement('div');
        empty.className = 'day empty';
        grid.appendChild(empty);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const ymd = fmtYmd(date);
        const el = document.createElement('div');
        el.className = 'day';
        if (bookedSet.has(ymd)) el.classList.add('booked');
        if (ymd === todayYmd) el.classList.add('today');
        const num = document.createElement('div');
        num.className = 'num';
        num.textContent = String(day);
        el.appendChild(num);
        grid.appendChild(el);
      }

      monthEl.appendChild(grid);
      monthsWrapper.appendChild(monthEl);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'calendar';
    wrapper.appendChild(monthsWrapper);
    container.appendChild(wrapper);
  }

  async function initAvailability() {
    const container = document.getElementById('availability');
    if (!container) return;
    const slug = container.dataset.slug;
    if (!slug) return;
    try {
      const base = document.querySelector('meta[name="base-path"]');
      const basePath = base ? base.getAttribute('content') || '/' : '/';
      const res = await fetch(`${basePath}availability/${slug}.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error('not ok');
      const data = await res.json();
      const booked = Array.isArray(data.bookedDates) ? data.bookedDates : [];
      if (booked.length === 0) {
        container.appendChild(makePlaceholder('No availability loaded yet.'));
      } else {
        renderCalendar(container, booked, 6);
      }
    } catch (e) {
      container.appendChild(makePlaceholder('Availability not found.'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAvailability);
  } else {
    initAvailability();
  }
})();


