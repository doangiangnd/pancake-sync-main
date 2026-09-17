(() => {
  const search = document.querySelector('#log-search');
  const filters = [...document.querySelectorAll('.filter')];
  let entries = [...document.querySelectorAll('.log-entry')];
  const visibleCount = document.querySelector('#visible-count');
  const noResults = document.querySelector('#no-results');
  const refreshButton = document.querySelector('#refresh-button');
  const lineCount = document.querySelector('#line-count');
  const liveState = document.querySelector('#live-state');
  const streamStatus = document.querySelector('#stream-status');
  let activeFilter = 'all';
  let refreshTimer;

  const applyFilters = () => {
    const term = search.value.trim().toLowerCase();
    let visible = 0;
    entries.forEach((entry) => {
      const categoryMatches =
        activeFilter === 'all' || entry.dataset.category === activeFilter;
      const searchMatches = !term || entry.dataset.search.includes(term);
      const show = categoryMatches && searchMatches;
      entry.hidden = !show;
      if (show) visible += 1;
    });
    visibleCount.textContent = String(visible);
    noResults.hidden = visible > 0 || entries.length === 0;
  };

  search.addEventListener('input', applyFilters);
  filters.forEach((button) => {
    button.addEventListener('click', () => {
      filters.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      activeFilter = button.dataset.filter;
      applyFilters();
    });
  });

  lineCount.value = String(window.LOG_VIEWER_LINES || 200);
  lineCount.addEventListener('change', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('lines', lineCount.value);
    window.location.assign(url.toString());
  });
  refreshButton.addEventListener('click', () => window.location.reload());

  const syncDashboard = async () => {
    try {
      const response = await fetch(window.location.href, { cache: 'no-store' });
      if (!response.ok) return;
      const nextDocument = new DOMParser().parseFromString(
        await response.text(),
        'text/html',
      );
      ['.capture-status', '.stats', '#log-list'].forEach((selector) => {
        const current = document.querySelector(selector);
        const next = nextDocument.querySelector(selector);
        if (current && next) current.replaceWith(next);
      });
      entries = [...document.querySelectorAll('.log-entry')];
      applyFilters();
    } catch {
      streamStatus.textContent = 'Chờ kết nối lại';
    }
  };

  const scheduleSync = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(syncDashboard, 150);
  };

  const stream = new EventSource('/api/webhook/logs/stream');
  stream.addEventListener('connected', () => {
    liveState.classList.remove('offline');
    liveState.querySelector('span').textContent = 'Realtime đang bật';
    streamStatus.textContent = 'Đã kết nối';
  });
  stream.addEventListener('log', scheduleSync);
  stream.onerror = () => {
    liveState.classList.add('offline');
    liveState.querySelector('span').textContent = 'Đang kết nối lại';
    streamStatus.textContent = 'Mất kết nối tạm thời';
  };
})();
