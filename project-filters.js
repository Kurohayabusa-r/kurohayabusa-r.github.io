/* Category changes animate one wrapper, keeping the grid's natural layout intact. */
(() => {
  const results = document.getElementById('project-results');
  const grid = document.getElementById('cards');
  if (!results || !grid) return;
  const buttons = [...document.querySelectorAll('.filter-btn')];
  const cards = [...grid.querySelectorAll('.card')];
  const summary = document.querySelector('.filter-summary');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 'all';
  let revision = 0;
  let animations = [];

  const cancel = () => {
    animations.forEach(animation => animation.cancel());
    animations = [];
  };
  const commit = filter => {
    window.dispatchEvent(new Event('projects-filter-change'));
    let count = 0;
    cards.forEach(card => {
      const matches = filter === 'all' || card.dataset.type === filter;
      card.classList.toggle('hidden', !matches);
      if (matches) count++;
    });
    summary.textContent = `Showing ${count} ${count === 1 ? 'project' : 'projects'}`;
  };
  const release = () => {
    cancel();
    results.style.removeProperty('height');
    grid.style.removeProperty('opacity');
    grid.style.removeProperty('transform');
    results.classList.remove('is-filtering');
    results.setAttribute('aria-busy', 'false');
  };
  const change = async (filter, immediate = false) => {
    const currentRevision = ++revision;
    selected = filter;
    buttons.forEach(button => {
      const active = button.dataset.filter === filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    // Preserve the current rendered frame when a fast click interrupts motion.
    const height = results.getBoundingClientRect().height;
    const rendered = getComputedStyle(grid);
    const opacity = rendered.opacity;
    const transform = rendered.transform;
    cancel();
    if (immediate || preference.matches || typeof grid.animate !== 'function') {
      commit(filter);
      release();
      return;
    }
    results.style.height = `${height}px`;
    grid.style.opacity = opacity;
    grid.style.transform = transform;
    results.classList.add('is-filtering');
    results.setAttribute('aria-busy', 'true');
    const fadeOut = grid.animate([{opacity, transform}, {opacity: 0, transform}], {
      duration: 140, easing: 'ease-out', fill: 'forwards'
    });
    animations.push(fadeOut);
    await fadeOut.finished.catch(() => {});
    if (currentRevision !== revision) return;

    commit(filter);
    grid.style.opacity = '0';
    grid.style.removeProperty('transform');
    cancel();
    const targetHeight = grid.getBoundingClientRect().height;
    const resize = results.animate([{height: `${height}px`}, {height: `${targetHeight}px`}], {
      duration: 500, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards'
    });
    const fadeIn = grid.animate([
      {opacity: 0, transform: 'translateY(8px)'},
      {opacity: 1, transform: 'translateY(0)'}
    ], {duration: 360, delay: 60, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both'});
    animations = [resize, fadeIn];
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
    if (currentRevision !== revision) return;
    release();
  };
  buttons.forEach(button => button.addEventListener('click', () => {
    if (button.dataset.filter !== selected) change(button.dataset.filter);
  }));
  const settle = () => {
    if (results.getAttribute('aria-busy') === 'true') change(selected, true);
  };
  preference.addEventListener('change', () => { if (preference.matches) settle(); });
  window.addEventListener('resize', settle);
  window.addEventListener('pagehide', settle);
  window.addEventListener('beforeprint', settle);
})();
