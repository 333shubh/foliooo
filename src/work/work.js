import * as THREE from 'three';
import { mountGrain } from '../ds/grain.js';
import { Stage } from '../ds/toon/stage.js';
import { galaxy, ORBIT } from '../ds/toon/worlds.js';
import { pageTransitions } from '../ds/transitions.js';
import { projects, cases } from '../content.js';

mountGrain();
pageTransitions();

/* =====================================================================
   WORK: a star system where every project is its own planet, painted from its brand.
     hello    the whole system on a sweeping arc (where the cockpit's Work window was looking)
     gallery  the camera flies to one planet; its landing page floats beside it on a glass
              screen; wheel / drag / arrows / ticks fly on to the next world
     case     "Open project": the project's own page rises over the system (#slug)
   Camera moves 1.6s easeInOutCubic; text arrives with easeOutCubic.
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const V = (...a) => new THREE.Vector3(...a);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n) => String(n).padStart(2, '0');
const N = projects.length;
const host = (url) => { try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; } };

const main = $('#work'), stage = new Stage($('#gl'));
const w = galaxy({ slugs: projects.map((p) => p.slug) });
stage.setWorld(w);

/* ------------------------------------------------ camera */
let mode = 'hello', current = 0;
const HELLO_P = w.P.clone(), HELLO_L = w.L.clone();
const fromP = V(), fromL = V(), goalP = V(), goalL = V(), inward = V(), right = V(), UP = V(0, 1, 0);
let t0 = 0, dur = 0;
const portrait = () => stage.canvas.clientWidth / stage.canvas.clientHeight < 0.95;
function goals() {
  if (mode === 'hello') { goalP.copy(HELLO_P); goalL.copy(HELLO_L); return; }
  const pl = w.planets[current], P = pl.obj.position, s = pl.obj.userData.size;
  if (mode === 'case') { goalP.set(P.x - s * 0.4, P.y + s * 0.2, P.z + s * 2.4); goalL.copy(P); return; }
  // come in from outside the orbit and look inward: the rest of the system becomes the backdrop
  inward.set(P.x - ORBIT.cx, 0, P.z - ORBIT.cz).normalize();          // pointing out, away from the middle
  right.crossVectors(inward.clone().negate(), UP).normalize();
  if (portrait()) { goalP.copy(P).addScaledVector(inward, s * 6.2).addScaledVector(UP, s * 1.3); goalL.copy(P).addScaledVector(UP, s * 1.2); return; }
  goalP.copy(P).addScaledVector(inward, s * 4.7).addScaledVector(UP, s * 0.9).addScaledVector(right, -s * 0.5);
  goalL.copy(P).addScaledVector(right, -s * 1.3).addScaledVector(UP, s * 0.15);
}
function move(d = 1.6) { fromP.copy(w.P); fromL.copy(w.L); t0 = performance.now(); dur = reduced ? 0 : d; }
const moving = () => dur > 0 && performance.now() - t0 < dur * 1000;
w.pre.push((dt) => {
  goals();
  const k = dur ? clamp((performance.now() - t0) / 1000 / dur) : 1;
  if (k < 1) { const e = easeInOut(k); w.P.lerpVectors(fromP, goalP, e); w.L.lerpVectors(fromL, goalL, e); w.P.y += Math.sin(e * Math.PI) * 2.2; }
  else { const f = 1 - Math.exp(-dt * 4); w.P.lerp(goalP, f); w.L.lerp(goalL, f); }
  w.swayK = mode === 'hello' ? 1 : mode === 'case' ? 0.1 : 0.45;
  w.planets.forEach((pl, i) => { pl.scaleGoal = mode === 'hello' || i === current ? 1 : 0.45; });   // in close-up the rest of the system steps back
});

/* ------------------------------------------------ planet names (the overview) */
const labelBox = document.createElement('div'); labelBox.className = 'work__labels'; $('#stage').after(labelBox);
const labels = projects.map((p, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'plabel'; b.style.setProperty('--i', i);
  b.innerHTML = `<span>${pad(i + 1)}</span>${p.name}`;
  b.setAttribute('aria-label', `${p.name}: fly there`);
  b.addEventListener('click', () => go(i));
  labelBox.appendChild(b);
  return b;
});
const pv = V();
stage.onFrame = (s) => {
  const cw = s.canvas.clientWidth, ch = s.canvas.clientHeight;
  w.planets.forEach((pl, i) => {
    pv.copy(pl.obj.position); pv.y -= pl.obj.userData.size * 1.25; pv.project(s.camera);
    labels[i].style.translate = `${((pv.x * 0.5 + 0.5) * cw).toFixed(1)}px ${((-pv.y * 0.5 + 0.5) * ch).toFixed(1)}px`;
    labels[i].classList.toggle('off', pv.z > 1);
  });
};

/* ------------------------------------------------ the glass screen with the landing page */
const holo = document.createElement('figure'); holo.className = 'holo'; holo.setAttribute('aria-hidden', 'true');
holo.innerHTML = '<div class="holo__glass"><div class="holo__chrome"><i></i><i></i><i></i><span></span></div><div class="holo__view"><img alt="" /></div></div><figcaption></figcaption>';
$('#slide').after(holo);
const holoImg = holo.querySelector('img'), holoHost = holo.querySelector('.holo__chrome span'), holoCap = holo.querySelector('figcaption');
let tiltX = 0, tiltY = 0;
addEventListener('pointermove', (e) => { tiltX = (e.clientX / innerWidth - 0.5) * 2; tiltY = (e.clientY / innerHeight - 0.5) * 2; });
(function tilt() { requestAnimationFrame(tilt); holo.style.setProperty('--tx', tiltX.toFixed(3)); holo.style.setProperty('--ty', tiltY.toFixed(3)); })();
function showHolo(i) {
  const p = projects[i];
  holo.classList.remove('on');
  setTimeout(() => {
    holoImg.src = `/work/${p.slug}.jpg`; holoImg.alt = `The ${p.name} landing page`;
    holoHost.textContent = p.live ? host(p.live) : p.name; holoCap.textContent = 'Landing page';
    holoImg.onload = () => { holo.style.setProperty('--travel', `${Math.max(0, holoImg.offsetHeight - holo.querySelector('.holo__view').clientHeight)}px`); };
    requestAnimationFrame(() => holo.classList.add('on'));
  }, reduced ? 0 : 380);
}

/* ------------------------------------------------ the editorial column */
const slide = $('#slide'), ticks = $('#ticks'), count = $('#count');
ticks.innerHTML = projects.map((p, i) => `<button type="button" data-i="${i}" aria-label="${p.name}"><span>${p.name}</span></button>`).join('');
const tickEls = [...ticks.children];
tickEls.forEach((b, i) => b.addEventListener('click', () => go(i)));
function renderSlide(i) {
  const p = projects[i];
  slide.innerHTML = `
    <p class="work__index"><span>${pad(i + 1)}</span><i></i><span>${p.year}</span></p>
    <h2 class="work__name">${p.name}</h2>
    <p class="work__line">${p.line}</p>
    <ul class="work__tags">${p.tags.map((t) => `<li>${t}</li>`).join('')}</ul>
    <div class="work__actions">
      <button class="btn btn--light" type="button" data-open><span class="btn__label">Open project</span><span class="btn__chip" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></button>
      ${p.live ? `<a class="link" href="${p.live}" target="_blank" rel="noopener">Visit ${host(p.live)} ↗</a>` : ''}
    </div>`;
  slide.querySelector('[data-open]').addEventListener('click', () => openCase(i));
  tickEls.forEach((b, j) => b.setAttribute('aria-current', j === i));
  count.innerHTML = `<b>${pad(i + 1)}</b> / ${pad(N)}`;
}
let slideTimer = 0;
function showSlide(i) {
  clearTimeout(slideTimer);
  slide.classList.remove('in');
  slideTimer = setTimeout(() => { renderSlide(i); requestAnimationFrame(() => slide.classList.add('in')); }, reduced ? 0 : 380);
}

/* ------------------------------------------------ the project's own page */
const caseEl = $('#case');
let pushed = false;                                        // did we add the #slug history entry ourselves?
const leaveCase = () => { if (pushed) history.back(); else { history.replaceState(null, '', location.pathname); closeCase(); } };
function renderCase(i) {
  const p = projects[i], c = cases[p.slug], next = projects[(i + 1) % N];
  caseEl.innerHTML = `
    <div class="case__bar">
      <button class="link case__back" type="button" data-close>← All work</button>
      <span>${pad(i + 1)} / ${pad(N)}</span>
    </div>
    <header class="case__head">
      <p class="case__eyebrow">${p.year} · ${p.tags.join(' · ')}</p>
      <h1 class="case__title" id="case-title">${p.name}</h1>
      <p class="case__intro">${c.intro}</p>
      <div class="case__links">
        ${p.live ? `<a class="btn" href="${p.live}" target="_blank" rel="noopener"><span class="btn__label">Visit ${host(p.live)}</span><span class="btn__chip" aria-hidden="true">↗</span></a>` : ''}
        ${p.repo ? `<a class="link" href="${p.repo}" target="_blank" rel="noopener">Source on GitHub ↗</a>` : ''}
      </div>
    </header>
    <section class="case__show" aria-label="${p.name} landing page">
      <div class="case__browser">
        <div class="case__chrome"><i></i><i></i><i></i><span>${p.live ? host(p.live) : p.name}</span></div>
        <div class="case__viewport"><img src="/work/${p.slug}.jpg" alt="The ${p.name} landing page" /></div>
      </div>
    </section>
    <section class="case__body">
      <div class="case__row"><h2>What it does</h2><ul>${c.does.map((d) => `<li>${d}</li>`).join('')}</ul></div>
      <div class="case__row"><h2>How it’s built</h2><p>${c.built}</p><ul class="case__stack">${p.tags.map((t) => `<li>${t}</li>`).join('')}</ul></div>
      <div class="case__row"><h2>Links</h2><p class="case__linklist">
        ${p.live ? `<a class="link" href="${p.live}" target="_blank" rel="noopener">${host(p.live)} ↗</a>` : ''}
        ${p.repo ? `<a class="link" href="${p.repo}" target="_blank" rel="noopener">${p.repo.replace('https://github.com/', 'github.com/')} ↗</a>` : ''}
      </p></div>
    </section>
    <a class="case__next" href="#${next.slug}" data-next>
      <span class="case__nextlabel">Next project</span>
      <span class="case__nextname">${next.name} →</span>
      <img src="/work/${next.slug}.jpg" alt="" loading="lazy" />
    </a>`;
  caseEl.querySelector('[data-close]').addEventListener('click', leaveCase);
  caseEl.querySelector('[data-next]').addEventListener('click', (e) => { e.preventDefault(); swapCase((i + 1) % N); });
  caseEl.scrollTop = 0;
  const vp = caseEl.querySelector('.case__viewport'), img = vp.querySelector('img'), show = caseEl.querySelector('.case__show');
  const onScroll = () => {
    const r = show.getBoundingClientRect(), span = show.offsetHeight - innerHeight;
    img.style.transform = `translateY(${(-(img.offsetHeight - vp.clientHeight) * clamp(-r.top / Math.max(1, span))).toFixed(1)}px)`;
  };
  caseEl.onscroll = onScroll; img.onload = onScroll; onScroll();
}
function openCase(i, { push = true, instant = false } = {}) {
  current = i; mode = 'case'; main.dataset.mode = 'case';
  renderCase(i); renderSlide(i);
  caseEl.hidden = false; requestAnimationFrame(() => caseEl.classList.add('open'));
  setTimeout(() => caseEl.focus({ preventScroll: true }), instant ? 0 : 600);
  move(instant ? 0 : 1.2);
  if (push) { history.pushState({ case: projects[i].slug }, '', `#${projects[i].slug}`); pushed = true; }
}
function closeCase() {
  if (mode !== 'case') return;
  mode = 'gallery'; main.dataset.mode = 'gallery';
  caseEl.classList.remove('open');
  setTimeout(() => { if (mode !== 'case') caseEl.hidden = true; }, reduced ? 0 : 1100);
  move(1.2); showSlide(current); showHolo(current);
}
function swapCase(i) {
  caseEl.classList.add('swap');
  setTimeout(() => { current = i; renderCase(i); renderSlide(i); move(1.2); caseEl.classList.remove('swap'); history.replaceState({ case: projects[i].slug }, '', `#${projects[i].slug}`); }, reduced ? 0 : 450);
}
addEventListener('popstate', () => {
  const i = projects.findIndex((p) => `#${p.slug}` === location.hash);
  if (i >= 0) openCase(i, { push: false }); else { pushed = false; closeCase(); }
});

/* ------------------------------------------------ flying between worlds */
function go(i) {
  i = clamp(i, 0, N - 1);
  if (mode === 'gallery' && i === current) return;
  const wasHello = mode === 'hello';
  current = i; mode = 'gallery'; main.dataset.mode = 'gallery';
  showSlide(i); showHolo(i); move(wasHello ? 1.9 : 1.6);
}
function hello() { mode = 'hello'; main.dataset.mode = 'hello'; slide.classList.remove('in'); holo.classList.remove('on'); move(1.7); }
const step = (d) => {
  if (mode === 'case' || moving()) return;
  if (mode === 'hello') { if (d > 0) go(0); return; }
  if (current + d < 0) { hello(); return; }
  go(current + d);
};
$('#begin').addEventListener('click', () => go(0));
$('#prev').addEventListener('click', () => step(-1));
$('#next').addEventListener('click', () => step(1));

const all = $('#all');
let acc = 0, accT = 0;
addEventListener('wheel', (e) => {
  if (mode === 'case' || !all.hidden) return;
  e.preventDefault();
  const now = performance.now();
  if (now - accT > 240) acc = 0;
  accT = now; acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(acc) > 40) { step(Math.sign(acc)); acc = 0; }
}, { passive: false });
let downX = null, downY = 0;
stage.canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
addEventListener('pointerup', (e) => {
  if (downX === null) return;
  const dx = e.clientX - downX, dy = e.clientY - downY; downX = null;
  if (mode === 'case') return;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  else if (Math.abs(dy) > 50 && portrait()) step(dy < 0 ? 1 : -1);
  else if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {        // tap a planet: fly there (or open it, if you're already there)
    const r = stage.canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), stage.camera);
    const hit = ray.intersectObjects(w.planets.map((p) => p.obj), true)[0];
    if (!hit) return;
    const i = w.planets.findIndex((p) => { let o = hit.object; while (o) { if (o === p.obj) return true; o = o.parent; } return false; });
    if (i < 0) return;
    if (mode === 'gallery' && i === current) openCase(i); else go(i);
  }
});
addEventListener('keydown', (e) => {
  if (e.altKey || e.metaKey || e.ctrlKey || e.target.closest('input, textarea')) return;
  if (e.key === 'Escape') { if (!all.hidden) setAll(false); else if (mode === 'case') leaveCase(); else if (mode === 'gallery') hello(); return; }
  if (mode === 'case' || !all.hidden) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); step(1); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
});

/* ------------------------------------------------ all projects, at a glance */
$('#all-items').innerHTML = projects.map((p, i) => `
  <li><button type="button" data-i="${i}">
    <img src="/work/${p.slug}.jpg" alt="" loading="lazy" />
    <span class="work__allname">${pad(i + 1)} · ${p.name}</span>
    <span class="work__allline">${p.line}</span>
  </button></li>`).join('');
const setAll = (open) => { all.hidden = !open; if (open) all.querySelector('button')?.focus(); };
$('#all-link').addEventListener('click', () => setAll(true));
$('#all-close').addEventListener('click', () => setAll(false));
all.addEventListener('click', (e) => {
  if (e.target === all) return setAll(false);
  const b = e.target.closest('[data-i]'); if (!b) return;
  setAll(false); openCase(+b.dataset.i);
});

/* ------------------------------------------------ start: #slug opens that project's page directly */
renderSlide(0);
const deep = projects.findIndex((p) => `#${p.slug}` === location.hash);
if (deep >= 0) { openCase(deep, { push: false, instant: true }); history.replaceState({ case: projects[deep].slug }, '', location.hash); }
else if (location.hash === '#all') setAll(true);
goals(); w.P.copy(goalP); w.L.copy(goalL);
