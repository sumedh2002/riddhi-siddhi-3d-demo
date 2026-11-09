/* Arch3 — site behaviour. No trackers, no cookies. Cal.com loads only when a visitor opens the calendar. */
(() => {
  const CAL_LINK = 'sumedh-ingle-1bd5lu/30min'; // Cal.com event (same as sumedhingle.com); change here only
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* nav: hairline once scrolled, mobile menu */
  const nav = $('[data-nav]'), menu = $('[data-menu]'), links = $('#nav-links');
  let ticking = false;
  const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { nav.classList.toggle('scrolled', scrollY > 8); ticking = false; }); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const setMenu = open => { links.classList.toggle('open', open); menu.setAttribute('aria-expanded', String(open)); };
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* reveal: only things below the fold start hidden, so nothing flickers on load */
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(el => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('pre'); io.observe(el); } });
  }

  /* story: the sticky frame follows the step in the middle of the screen */
  const steps = $$('.step'), frames = $$('.frame-in img'), label = $('[data-frame-label]');
  if (steps.length && 'IntersectionObserver' in window) {
    const show = i => {
      steps.forEach((s, k) => s.classList.toggle('on', k === i));
      frames.forEach((f, k) => f.classList.toggle('on', k === i));
      if (label) label.textContent = steps[i].querySelector('.step-n').textContent;
    };
    const so = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) show(+e.target.dataset.step); }), { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(s => so.observe(s)); show(0);
  }

  /* playground: the live 3D loads only on wide screens, and only when it's close */
  const pg = $('[data-pg]'), frame = pg && $('iframe', pg), wide = matchMedia('(min-width: 861px)');
  if (frame) {
    let loaded = false;
    const load = () => { if (!loaded && wide.matches) { loaded = true; frame.src = frame.dataset.src; } };
    if ('IntersectionObserver' in window) {
      const po = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { load(); if (loaded) po.disconnect(); } }, { rootMargin: '600px 0px' });
      po.observe(pg);
      wide.addEventListener && wide.addEventListener('change', () => { po.unobserve(pg); po.observe(pg); });
    } else load();
  }

  /* booking: Cal.com inline calendar, loaded on demand */
  const calBox = $('#cal-inline');
  let calStarted = false;
  function openCal() {
    calBox.hidden = false;
    if (calStarted) return;
    calStarted = true;
    (function (C, A, L) { const p = (a, ar) => a.q.push(ar), d = C.document; C.Cal = C.Cal || function () { const cal = C.Cal, ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; const s = d.createElement('script'); s.src = A; s.async = true; s.onerror = fail; d.head.appendChild(s); cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }, ns = ar[1]; api.q = api.q || []; if (typeof ns === 'string') { cal.ns[ns] = cal.ns[ns] || api; p(cal.ns[ns], ar); p(cal, ['initNamespace', ns]); } else p(cal, ar); return; } p(cal, ar); }; })(window, 'https://app.cal.com/embed/embed.js', 'init');
    window.Cal('init', 'arch3', { origin: 'https://app.cal.com' });
    window.Cal.ns.arch3('ui', { theme: 'light', cssVarsPerTheme: { light: { 'cal-brand': '#2F4BFF' } }, hideEventTypeDetails: false, layout: 'month_view' });
    window.Cal.ns.arch3('inline', { elementOrSelector: '#cal-inline', calLink: CAL_LINK, config: { layout: 'month_view' } });
  }
  function fail() { calBox.hidden = true; window.open('https://cal.com/' + CAL_LINK, '_blank', 'noopener'); }
  $$('[data-cal-open]').forEach(b => b.addEventListener('click', () => { openCal(); calBox.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }));
  $$('[data-book]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); setMenu(false); openCal(); $('#contact').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }));

  const y = $('[data-year]'); if (y) y.textContent = new Date().getFullYear();
})();
