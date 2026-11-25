import * as THREE from 'three';
import { mountGrain } from './grain.js';
import { Stage } from './toon/stage.js';
import { WORLDS } from './toon/worlds.js';
import { reveal, pageTransitions } from './transitions.js';
import { pinTags } from './tags.js';
import { mountCockpit } from './cockpit.js';
import { mountScenes } from './scenes.js';

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

mountScenes();

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
mountCockpit(document.getElementById('cockpit'), { dots: document.getElementById('dots') });

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
