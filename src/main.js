import Lenis from 'lenis';
import { config } from './config.js';
import { Scene } from './scene.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- copy
$('#role').textContent = config.role;
$('#bio').textContent = config.bio;
$('#sr-title').textContent = `${config.name}, ${config.role}`;
const nav = $('#nav');
config.nav.forEach((n) => {
  const a = document.createElement('a');
  a.href = `#${n.id}`;
  a.textContent = n.label;
  a.addEventListener('click', (e) => { e.preventDefault(); goNext(); });
  nav.appendChild(a);
});

// ---------------------------------------------------------------- scene
let scene = null;
try { scene = new Scene($('#gl'), config.name); }
catch (e) { console.warn('WebGL unavailable', e); document.documentElement.classList.add('no-gl'); }
if (import.meta.env.DEV) window.__scene = scene;
document.fonts.load('400 100px "Anton"').then(() => scene?.drawName()).catch(() => {});
addEventListener('resize', () => scene?.resize());

// ---------------------------------------------------------------- scroll
const lenis = new Lenis({ duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
const hero = $('.hero');
const range = () => hero.offsetHeight - innerHeight;
let progress = 0;
lenis.on('scroll', ({ scroll }) => { progress = clamp(scroll / range()); });
const goNext = () => lenis.scrollTo(range(), { duration: reduced ? 0 : 2.6 });
document.querySelectorAll('[data-top]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); lenis.scrollTo(0, { duration: reduced ? 0 : 2.2 }); }));

// ---------------------------------------------------------------- pointer
const ptr = { x: innerWidth / 2, y: innerHeight * 0.4, has: false };
addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.has = true; }, { passive: true });

const poke = $('#poke');
const creature = { hover: 0, hop: 0, hopV: 0, squash: 0, squashV: 0, idea: 0, blink: 1, nextBlink: 0, blinkT: -1 };

function overCreature(x, y) {
  if (!scene) return false;
  const c = scene.creatureScreen(creature.hop);
  const dx = (x - c.x) / (c.rx * 1.25), dy = (y - c.y) / (c.ry * 1.6);
  return dx * dx + dy * dy < 1;
}

addEventListener('pointerdown', (e) => {
  if (e.target.closest('a, button') || progress > 0.3 || !awake) return;
  if (!overCreature(e.clientX, e.clientY)) return;
  creature.idea = 1;
  if (creature.hop < 0.01) { creature.hopV = 0.95; creature.squashV = -6; }
});

// ---------------------------------------------------------------- intro
// Light flickers on, the creature opens its eyes, then the neon buzzes on.
const flick = [0, 1, 0, 0, 0.6, 0, 0, 1, 0.35, 1];
function flicker(t, start, dur) {
  if (t <= start) return 0;
  if (t >= start + dur) return 1;
  return flick[Math.floor(((t - start) / dur) * flick.length)];
}
const T = reduced
  ? { light: [0, 0.01], eyes: 0, sign: [0, 0.01], ui: 0 }
  : { light: [0.5, 1.1], eyes: 2.0, sign: [2.6, 0.9], ui: 3.6 };
let awake = false, uiShown = false;

// ---------------------------------------------------------------- loop
const next = $('#next');
let last = performance.now(), t = 0, sp = 0;
const m = { x: 0, y: 0.3 };

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  lenis.raf(now);
  sp = damp(sp, progress, 5, dt);

  const w = innerWidth, h = innerHeight, aspect = w / h;
  const tx = (ptr.x / w - 0.5) * 2 * aspect, ty = -(ptr.y / h - 0.5) * 2;
  m.x = damp(m.x, tx, 6, dt); m.y = damp(m.y, ty, 6, dt);

  // intro
  const light = flicker(t, ...T.light) * (1 - 0.04 * Math.max(0, Math.sin(t * 23) * Math.sin(t * 7.3))); // tiny hum
  const sign = flicker(t, ...T.sign);
  if (!awake && t > T.eyes) { awake = true; creature.blinkT = 0; creature.nextBlink = t + 2.5; }
  if (!uiShown && t > T.ui) { uiShown = true; document.body.classList.remove('is-loading'); }

  // blinking
  if (awake) {
    if (creature.blinkT >= 0) {
      creature.blinkT += dt;
      const bt = creature.blinkT / 0.16;          // close then open over 160ms
      creature.blink = bt < 1 ? Math.abs(1 - bt * 2) : 0;
      if (bt >= 1) { creature.blinkT = -1; creature.blink = 0; }
    } else if (t > creature.nextBlink) {
      creature.blinkT = 0;
      creature.nextBlink = t + 2.2 + Math.random() * 3.5 + (Math.random() < 0.2 ? -2 : 0);
    }
  }

  // hover + physics
  const hovering = awake && ptr.has && progress < 0.3 && overCreature(ptr.x, ptr.y);
  creature.hover = damp(creature.hover, hovering ? 1 : 0, 8, dt);
  document.body.style.cursor = hovering ? 'pointer' : '';
  creature.hopV -= 4.2 * dt;
  creature.hop += creature.hopV * dt * 0.25;
  if (creature.hop < 0) {
    if (creature.hopV < -0.4) creature.squashV += 8 * Math.min(1, -creature.hopV);
    creature.hop = 0; creature.hopV = 0;
  }
  creature.squashV += (-creature.squash * 180 - creature.squashV * 10) * dt;
  creature.squash += creature.squashV * dt;
  creature.idea = Math.max(0, creature.idea - dt * 0.7);

  if (scene) {
    const u = scene.u;
    u.uTime.value = t;
    u.uMouse.value.set(m.x, m.y);
    u.uLight.value = light;
    u.uSign.value = sign;
    u.uScroll.value = sp;
    u.uBlink.value = awake ? creature.blink : 1;
    u.uWake.value = 1;
    // eyes look at the cursor (or up at the light right as it turns on)
    const cy = -0.42 + 0.1 + creature.hop;
    let lx = clamp((m.x - 0) / 0.9, -1, 1), ly = clamp((m.y - cy) / 0.7, -1, 1);
    if (!ptr.has) { lx = Math.sin(t * 0.4) * 0.4; ly = 0.6; }
    u.uLook.value.set(damp(u.uLook.value.x, lx, 10, dt), damp(u.uLook.value.y, ly, 10, dt));
    u.uSquash.value = clamp(creature.squash, -1, 1) + Math.sin(t * 2.4) * 0.04;   // breathing
    u.uHop.value = creature.hop;
    u.uIdea.value = creature.idea;
    u.uHover.value = creature.hover;
    scene.render();

    const c = scene.creatureScreen(creature.hop);
    poke.style.left = `${c.x}px`;
    poke.style.top = `${c.y - c.ry * 3.6}px`;
    poke.classList.toggle('on', hovering && creature.idea < 0.3);
  }

  const on = smooth(0.82, 0.98, sp);
  next.style.opacity = on.toFixed(3);
  next.classList.toggle('on', on > 0.5);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
