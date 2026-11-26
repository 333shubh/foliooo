/* ==========================================================================
   Transitions: kept simple, like the reference.
     reveal()           sections and cards fade up as they enter
     pageTransitions()  between pages: content fades out to the page colour,
                        the next page fades in. No wipes, no gimmicks.
   Durations and eases come from tokens.css (--d-*, --ease-*).
   ========================================================================== */

export function reveal(root = document) {
  const els = root.querySelectorAll('[data-reveal]');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      const i = [...(el.parentElement?.children || [])].filter((c) => c.hasAttribute('data-reveal')).indexOf(el);
      el.style.transitionDelay = `${Math.max(0, i) * 70}ms`;   // siblings stagger
      el.classList.add('is-in');
      io.unobserve(el);
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  els.forEach((el) => io.observe(el));
}

export function pageTransitions() {
  // Where the browser has cross-page view transitions, it runs the reference's vertical wipe itself
  // (@view-transition in components.css; each page's <head> names the direction). Otherwise: the fade below.
  if ('onpagereveal' in window) { document.documentElement.classList.remove('is-entering'); return; }
  document.documentElement.classList.add('is-entering');
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('is-entering')));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return; // same-page anchors scroll normally
    e.preventDefault();
    document.documentElement.classList.add('is-leaving');
    setTimeout(() => { location.href = url.href; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420);
  });
}
