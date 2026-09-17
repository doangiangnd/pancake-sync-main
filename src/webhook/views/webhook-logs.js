(() => {
  const search = document.querySelector('#log-search');
  const filters = [...document.querySelectorAll('.filter')];
  const entries = [...document.querySelectorAll('.log-entry')];
  const visibleCount = document.querySelector('#visible-count');
  const noResults = document.querySelector('#no-results');
  const countdown = document.querySelector('#countdown');
  const refreshButton = document.querySelector('#refresh-button');
  const lineCount = document.querySelector('#line-count');
  let activeFilter = 'all';
  let seconds = 15;

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
  window.setInterval(() => {
    seconds -= 1;
    countdown.textContent = String(seconds);
    if (seconds <= 0) window.location.reload();
  }, 1000);
})();
