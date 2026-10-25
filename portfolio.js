/* Keep navigation state in step with the visible section; content works without JS. */
(() => {
  const links = [...document.querySelectorAll('.nav-links a[data-section]')];
  if (!links.length) return;
  const sections = links.map(link => ({link, section: document.getElementById(link.dataset.section)})).filter(item => item.section);
  let pending = false;
  const update = () => {
    const marker = window.innerHeight * 0.35;
    const current = sections.find(({section}) => {
      const bounds = section.getBoundingClientRect();
      return bounds.top <= marker && bounds.bottom > marker;
    });
    for (const {link} of sections) {
      const active = link === current?.link;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    pending = false;
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  update();
})();

/* Animate only as content enters view; the document stays visible without JS. */
(() => {
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motionPreference.matches || typeof Element.prototype.animate !== 'function') {
    document.documentElement.classList.remove('hero-preparing', 'page-preparing');
    return;
  }

  const active = new Map();
  const seen = new WeakSet();
  const pending = new Set();
  const revealDistance = window.matchMedia('(max-width: 600px)').matches ? 22 : 30;
  const reveal = (element, delay = 0) => {
    if (seen.has(element) || motionPreference.matches) return;
    seen.add(element);
    const originalWillChange = element.style.willChange;
    const isContactText = Boolean(element.closest('.contact-section'));
    const isHero = Boolean(element.closest('.hero'));
    const distance = isHero ? 8 : element.matches('.page-hero, .case-hero, .catalog-toolbar') ? 12 : isContactText ? 14 : revealDistance;
    const keyframes = [
      {opacity: 0, transform: `translateY(${distance}px)`},
      {opacity: 1, transform: 'translateY(0)'}
    ];
    element.style.willChange = 'opacity, transform';
    const animation = element.animate(keyframes, {
      duration: 920,
      delay,
      easing: 'cubic-bezier(.22,.61,.36,1)',
      fill: 'backwards'
    });
    active.set(element, animation);
    // Install the animation before releasing the prepared transparent state.
    pending.delete(element);
    element.classList.remove('reveal-pending');
    const cleanup = () => {
      if (active.get(element) === animation) {
        active.delete(element);
        element.style.willChange = originalWillChange;
      }
    };
    animation.finished.then(cleanup, cleanup);
  };

  const entrance = [...document.querySelectorAll(
    '.hero-topline, .hero-name, .hero-bottom, .page-hero, .case-hero, ' +
    '.home-page .work-section > .section-heading, .home-page .featured-work > .project-cover, .home-page .featured-work > .work-details, ' +
    '.entry-page .catalog-toolbar, .entry-page .card, .entry-page .notes-empty, .entry-page .template-reference, ' +
    '.case-body .case-cover, .case-body .case-section, .case-body .case-end, .case-body .epicentre-gallery'
  )];
  const entranceSet = new Set(entrance);
  const preparedPage = document.querySelector('.entry-page, .case-body');
  const root = document.documentElement;
  const homepageHero = document.querySelector('.home-page .hero');
  const finishHero = () => {
    root.classList.remove('hero-preparing', 'hero-entering', 'page-preparing');
    window.dispatchEvent(new Event('hero-ready'));
  };
  const startEntrance = () => {
    if (motionPreference.matches) { finishHero(); return; }
    // If the safety fallback already showed the hero, never hide it again.
    if (homepageHero && !root.classList.contains('hero-preparing')) return;
    if (preparedPage && !root.classList.contains('page-preparing')) return;
    if (homepageHero) root.classList.add('hero-entering');
    const animations = [];
    entrance.forEach((element, index) => {
      const bounds = element.getBoundingClientRect();
      if (bounds.top < innerHeight && bounds.bottom > 0) {
        reveal(element, Math.min(index * 70, 140));
        const animation = active.get(element);
        if (animation) animations.push(animation.finished.catch(() => {}));
      }
    });
    root.classList.remove('hero-preparing', 'page-preparing');
    Promise.all(animations).then(finishHero);
  };
  if (homepageHero || preparedPage) {
    // Trigger font layout before waiting, then let restored scroll positions settle.
    (homepageHero || preparedPage).getBoundingClientRect();
    const heroFonts = Promise.all([
      document.fonts.load('600 1em "DM Sans"'),
      document.fonts.load('400 1em "DM Sans"'),
      document.fonts.load('400 1em "JetBrains Mono"')
    ]);
    const scheduleEntrance = () => requestAnimationFrame(() => requestAnimationFrame(startEntrance));
    heroFonts.then(scheduleEntrance, scheduleEntrance);
  } else startEntrance();

  let observer;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      const entering = entries.filter(entry => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      entering.forEach((entry, index) => {
        observer.unobserve(entry.target);
        reveal(entry.target, Math.min(index * 100, 200));
      });
    }, {threshold: 0.04, rootMargin: '0px 0px -64px 0px'});
    const targets = [...document.querySelectorAll(
      '.section-heading, .project-cover, .work-details, .secondary-work, .website-work, .epicentre-work, .epicentre-gallery, ' +
      '.about-grid > *, .practice-list, .exp-item, .contact-section h2, ' +
      '.contact-bottom, .card, .case-cover, .case-section, .case-end, .notes-empty'
    )];
    const targetSet = new Set(targets);
    targets.forEach(element => {
      // Animate a group once; nested reveals compound motion and opacity.
      let parent = element.parentElement;
      while (parent) {
        if (targetSet.has(parent)) return;
        parent = parent.parentElement;
      }
      const bounds = element.getBoundingClientRect();
      // Only prepare content still below the screen. Restored scroll positions
      // and direct section links must never hide text that is already visible.
      if (bounds.top < window.innerHeight || element.matches(':focus-within')) {
        // The initial entrance owns visible page content; do not mark it played.
        if ((preparedPage || homepageHero) && entranceSet.has(element) && bounds.bottom > 0) return;
        seen.add(element);
        return;
      }
      pending.add(element);
      element.classList.add('reveal-pending');
      observer.observe(element);
    });
  }

  const stop = () => {
    finishHero();
    observer?.disconnect();
    active.forEach(animation => animation.cancel());
    pending.forEach(element => {
      element.classList.remove('reveal-pending');
      seen.add(element);
    });
    pending.clear();
  };
  motionPreference.addEventListener('change', event => {
    if (event.matches) {
      observer?.disconnect();
      stop();
    }
  });
  document.addEventListener('focusin', event => {
    pending.forEach(element => {
      if (element.contains(event.target)) {
        observer?.unobserve(element);
        element.classList.remove('reveal-pending');
        pending.delete(element);
        seen.add(element);
      }
    });
    active.forEach((animation, element) => {
      if (element.contains(event.target)) animation.finish();
    });
  });
  // Filtering owns card visibility once a category is selected.
  window.addEventListener('projects-filter-change', () => {
    document.querySelectorAll('#cards .card').forEach(element => {
      observer?.unobserve(element);
      seen.add(element);
      pending.delete(element);
      element.classList.remove('reveal-pending');
      active.get(element)?.cancel();
    });
  });
  window.addEventListener('pagehide', stop);
  window.addEventListener('beforeprint', stop);
})();

/* Scroll-linked layers use individual translate, separate from reveal and hover transforms. */
(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compact = window.matchMedia('(max-width: 600px)');
  const heroRates = new Map([
    ['hero-name', 0.12],
    ['hero-intro', 0.07],
    ['hero-note', 0.045],
    ['hero-topline', 0.025]
  ]);
  const items = [...document.querySelectorAll(
    '.project-cover, .catalog-cover, .epicentre-preview, ' +
    '.home-page .hero-name, .home-page .hero-intro, .home-page .hero-note, .home-page .hero-topline'
  )].map(element => ({
    element,
    current: 0,
    heroRate: [...heroRates].find(([name]) => element.classList.contains(name))?.[1] || 0
  }));
  if (!items.length) return;

  const visible = new Set();
  let frame = 0;
  let previousTime = 0;
  let printing = false;
  const reset = item => {
    item.current = 0;
    item.initialized = false;
    item.element.style.removeProperty('--parallax-offset');
    item.element.removeAttribute('data-parallax');
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    items.forEach(reset);
  };
  const update = time => {
    frame = 0;
    if (preference.matches || printing || document.hidden) return;
    const elapsed = previousTime ? Math.min(time - previousTime, 64) : 16;
    previousTime = time;
    const blend = 1 - Math.exp(-elapsed / 85);
    const distance = compact.matches ? 12 : 24;
    const viewport = window.innerHeight;
    // Read every position before writing styles to avoid repeated layout work.
    const positions = [...visible].map(item => {
      if (item.heroRate) {
        // Start at zero and cap each text layer within the hero's existing spacing.
        const maximum = (compact.matches ? 18 : 36) * item.heroRate / 0.12;
        const target = Math.max(0, window.scrollY) * item.heroRate * (compact.matches ? 0.7 : 1);
        const offset = Math.min(target, maximum);
        // Restore the scroll layer before the fade, rather than sliding it in afterwards.
        if (!item.initialized || document.documentElement.classList.contains('hero-preparing')) {
          item.current = offset;
          item.initialized = true;
        }
        return {item, target: offset};
      }
      const bounds = item.element.getBoundingClientRect();
      const center = bounds.top - item.current + bounds.height / 2;
      const progress = (viewport / 2 - center) / ((viewport + bounds.height) / 2);
      return {item, target: Math.max(-1, Math.min(1, progress)) * distance};
    });
    let moving = false;
    positions.forEach(({item, target}) => {
      const difference = target - item.current;
      item.current = Math.abs(difference) < 0.05 ? target : item.current + difference * blend;
      if (Math.abs(difference) >= 0.05) moving = true;
      item.element.setAttribute('data-parallax', 'active');
      item.element.style.setProperty('--parallax-offset', `${item.current.toFixed(2)}px`);
    });
    if (moving) frame = requestAnimationFrame(update);
    else previousTime = 0;
  };
  const schedule = () => {
    if (!frame && !preference.matches && !printing && !document.hidden) frame = requestAnimationFrame(update);
  };
  if ('IntersectionObserver' in window) {
    const lookup = new Map(items.map(item => [item.element, item]));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const item = lookup.get(entry.target);
        if (entry.isIntersecting) visible.add(item);
        else { visible.delete(item); reset(item); }
      });
      schedule();
    }, {rootMargin: '160px 0px'});
    items.forEach(item => observer.observe(item.element));
  } else items.forEach(item => visible.add(item));

  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('hero-ready', schedule);
  window.addEventListener('pagehide', stop);
  preference.addEventListener('change', () => preference.matches ? stop() : schedule());
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : schedule());
  window.addEventListener('beforeprint', () => { printing = true; stop(); });
  window.addEventListener('afterprint', () => { printing = false; schedule(); });
  schedule();
})();
