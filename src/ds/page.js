import * as THREE from 'three';
import { mountGrain } from './grain.js';
import { Stage } from './toon/stage.js';
import { WORLDS } from './toon/worlds.js';
import { reveal, pageTransitions } from './transitions.js';

mountGrain();
pageTransitions();

/* ---------------- swatches (from the tokens, so they never drift) ------- */
const RAMPS = {
  Ink: ['ink-900', 'ink-800', 'ink-700', 'ink-600'],
  Violet: ['violet-700', 'violet-600', 'violet-500', 'violet-400', 'violet-300'],
  Lilac: ['lilac-500', 'lilac-400', 'lilac-300', 'lilac-200', 'lilac-100'],
  Paper: ['paper-0', 'paper-50', 'paper-100', 'paper-200', 'stone-500'],
  Signal: ['lime-400', 'lime-200', 'rust-600', 'sky-400'],
};
const css = getComputedStyle(document.documentElement);
document.getElementById('swatches').innerHTML = Object.entries(RAMPS).map(([name, keys]) => `
  <div class="ds-ramp"><h4>${name}</h4><div class="ds-ramp__row">${keys.map((k) => {
    const v = css.getPropertyValue(`--${k}`).trim();
    return `<div class="ds-swatch"><i style="background:${v}"></i><div><b>${k}</b><code>${v}</code></div></div>`;
  }).join('')}</div></div>`).join('');

/* ---------------- 2D world horizons for cards (same palette as 3D) ------- */
const INK = '#160923';
const SCENES = {
  development: `<path d="M0 205 Q60 170 120 190 T250 180 T400 175 V300 H0Z" fill="#6cbf5f" stroke="${INK}" stroke-width="1.5"/><path d="M0 240 Q90 215 180 235 T400 225 V300 H0Z" fill="#a6e083" stroke="${INK}" stroke-width="1.5"/><g stroke="${INK}" stroke-width="1.5"><rect x="292" y="178" width="7" height="22" fill="#7a3a26"/><circle cx="296" cy="168" r="16" fill="#4fae5a"/><rect x="82" y="196" width="6" height="18" fill="#7a3a26"/><circle cx="85" cy="187" r="12" fill="#4fae5a"/></g>`,
  uiux: `<path d="M0 150 L70 120 L120 160 L190 110 L260 165 L330 125 L400 150 V300 H0Z" fill="#2a7a6f" stroke="${INK}" stroke-width="1.5"/><rect x="0" y="190" width="400" height="110" fill="#c58cf5" stroke="${INK}" stroke-width="1.5"/><g stroke="#e6b8ff" stroke-width="3" stroke-linecap="round"><path d="M40 220h50M150 245h70M280 215h60M90 270h40"/></g><path d="M300 198 q30 -18 70 0Z" fill="#3a9a85" stroke="${INK}" stroke-width="1.5"/>`,
  graphic: `<path d="M0 175 H40 V130 H110 V175 H180 V150 H240 V110 H320 V175 H400 V300 H0Z" fill="#9c4535" stroke="${INK}" stroke-width="1.5"/><path d="M0 200 Q120 185 220 205 T400 195 V300 H0Z" fill="#d4704e" stroke="${INK}" stroke-width="1.5"/><ellipse cx="300" cy="245" rx="26" ry="12" fill="#9c4535" stroke="${INK}" stroke-width="1.5"/>`,
  branding: `<circle cx="80" cy="360" r="190" fill="#7a3aa8" stroke="${INK}" stroke-width="1.5"/><path d="M290 70 l14 8 -3 16 -16 4 -10 -12 4 -14z" fill="#2f1547" stroke="${INK}" stroke-width="1.5"/><rect x="330" y="150" width="8" height="34" fill="#e2a4ff" stroke="${INK}" stroke-width="1.5" transform="rotate(30 334 167)"/><path d="M220 210 l18 -6 12 14 -6 18 -18 2 -10 -14z" fill="#a6f78f" stroke="${INK}" stroke-width="1.5"/><g fill="#fff"><circle cx="210" cy="60" r="1.6"/><circle cx="360" cy="40" r="1.4"/><circle cx="150" cy="120" r="1.2"/></g>`,
  research: `<path d="M0 230 L0 160 L70 205 L110 240Z M400 230 L400 140 L320 200 L290 240Z" fill="#4a1f6e" stroke="${INK}" stroke-width="1.5"/><rect x="0" y="230" width="400" height="70" fill="#2a7a6f" stroke="${INK}" stroke-width="1.5"/><g fill="none" stroke="#fff" stroke-opacity=".6" stroke-dasharray="3 4"><path d="M90 60 L160 100 L230 50 L300 110"/></g><g fill="#fff"><circle cx="90" cy="60" r="3"/><circle cx="160" cy="100" r="3.5"/><circle cx="230" cy="50" r="3"/><circle cx="300" cy="110" r="3"/></g>`,
};
document.querySelectorAll('[data-scene]').forEach((el) => {
  el.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 400 300" preserveAspectRatio="${el.closest('.case-hero') ? 'none' : 'xMidYMax slice'}" aria-hidden="true">${SCENES[el.dataset.scene] || ''}</svg>`);
});

/* ---------------- tags pinned to 3D points ------------------------------ */
const v = new THREE.Vector3();
function pinTags(stage, layer, items) {
  const els = items.map((it) => {
    const el = document.createElement('div');
    el.className = 'tag' + (it.live ? ' tag--live' : '');
    el.innerHTML = `<span class="tag__label">${it.label}</span><span class="tag__leader" style="height:${it.leader ?? 46}px"></span>`;
    layer.appendChild(el);
    return el;
  });
  const prev = stage.onFrame;
  stage.onFrame = (s) => {
    prev?.(s);
    const w = stage.canvas.clientWidth, h = stage.canvas.clientHeight;
    items.forEach((it, i) => {
      it.get(v); v.project(stage.camera);
      els[i].style.opacity = v.z > 1 ? 0 : 1;
      els[i].style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      els[i].style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
    });
  };
}

/* ---------------- hero: outer space ------------------------------------- */
const hero = new Stage(document.getElementById('hero-gl'));
const space = WORLDS.space();
hero.setWorld(space);
pinTags(hero, document.getElementById('hero-tags'), [
  ...space.constellation.userData.nodes.slice(0, 3).map((n, i) => ({ label: n.name, live: i === 0, leader: 40, get: (out) => out.copy(n.pos) })),
  { label: 'You are here', live: true, leader: 70, get: (out) => space.pod.getWorldPosition(out).add(new THREE.Vector3(0, 3.4, 0)) },
]);

/* ---------------- 3D kit turntable -------------------------------------- */
const kit = new Stage(document.getElementById('props-gl'), { dpr: 2 });
const props = WORLDS.props();
kit.setWorld(props);
pinTags(kit, document.getElementById('props-tags'), Object.entries(props.anchors).map(([name, o]) => ({
  label: name, leader: 16, get: (out) => o.getWorldPosition(out).add(new THREE.Vector3(0, name === 'Tree' ? 3.3 : 2, 0)),
})));

/* ---------------- cockpit carousel -------------------------------------- */
const cockpit = document.getElementById('cockpit');
const track = document.getElementById('track');
const windows = [...track.querySelectorAll('.window')];
const dots = document.getElementById('dots');
windows.forEach((win, i) => {
  const stage = new Stage(win.querySelector('canvas'), { dpr: 1.5 });
  stage.setWorld(WORLDS[win.dataset.world]({ pod: false })); // you are inside the pod here
  const b = document.createElement('button');
  b.setAttribute('aria-label', win.querySelector('h3').textContent);
  b.addEventListener('click', () => go(i));
  dots.appendChild(b);
});
let active = 0, dragX = null, dragOff = 0;
const offsetFor = (i) => cockpit.clientWidth / 2 - (windows[i].offsetLeft + windows[i].offsetWidth / 2);
function go(i) {
  active = (i + windows.length) % windows.length;
  windows.forEach((w, j) => w.setAttribute('aria-current', j === active));
  [...dots.children].forEach((d, j) => d.setAttribute('aria-current', j === active));
  track.style.transform = `translateX(${offsetFor(active)}px)`;
}
cockpit.addEventListener('pointerdown', (e) => { if (e.target.closest('a,button')) return; dragX = e.clientX; dragOff = 0; cockpit.classList.add('is-dragging'); cockpit.setPointerCapture(e.pointerId); });
cockpit.addEventListener('pointermove', (e) => { if (dragX === null) return; dragOff = e.clientX - dragX; track.style.transform = `translateX(${offsetFor(active) + dragOff}px)`; });
const endDrag = () => { if (dragX === null) return; cockpit.classList.remove('is-dragging'); dragX = null; go(active + (dragOff < -60 ? 1 : dragOff > 60 ? -1 : 0)); };
cockpit.addEventListener('pointerup', endDrag); cockpit.addEventListener('pointercancel', endDrag);
cockpit.tabIndex = 0;
cockpit.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') go(active + 1); if (e.key === 'ArrowLeft') go(active - 1); });
addEventListener('resize', () => go(active));
go(active);

/* ---------------- Work filters (demo: filters the project cards) --------- */
const filters = document.getElementById('filters');
filters?.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-f]'); if (!b) return;
  filters.querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', x === b));
  document.querySelectorAll('.project-card[data-cat]').forEach((c) => { c.hidden = b.dataset.f !== 'all' && c.dataset.cat !== b.dataset.f; });
});

/* ---------------- Contact: copy email, local time ----------------------- */
document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(b.dataset.copy); } catch {}
  b.textContent = 'Copied'; b.dataset.done = '';
  setTimeout(() => { b.textContent = 'Copy'; delete b.dataset.done; }, 1600);
}));
const clock = document.getElementById('local-time');
const tick = () => { if (clock) clock.textContent = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date()) + ' here'; };
tick(); setInterval(tick, 30_000);

reveal();
