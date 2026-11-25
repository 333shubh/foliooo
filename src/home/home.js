import * as THREE from 'three';
import Lenis from 'lenis';
import { mountGrain } from '../ds/grain.js';
import { Stage } from '../ds/toon/stage.js';
import { space } from '../ds/toon/worlds.js';
import { makePod, makeRock, makeShard, rng } from '../ds/toon/props.js';
import { toon } from '../ds/toon/materials.js';
import { mountCockpit } from '../ds/cockpit.js';
import { pageTransitions, reveal } from '../ds/transitions.js';
import { pages, facts } from '../content.js';

mountGrain();
pageTransitions();
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // the reference's camera ease
const easeOut = (t) => 1 - Math.pow(1 - t, 3);                                             // …and its UI ease
const easeIn = (t) => t * t * t;
const bump = (t) => Math.sin(clamp(t) * Math.PI);
const lerp = THREE.MathUtils.lerp;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const V = (...a) => new THREE.Vector3(...a);
const T0 = performance.now();

/* =====================================================================
   THE MISSION, played like the reference: not scrubbed by scroll. Each beat is
   a fixed eased move (easeInOutCubic, ~2.4s), then a hold, then it moves on by
   itself. Scroll / swipe / arrow keys skip ahead, Skip cuts to the cockpit.
     0  hero: the blueprint sheet. Waits for you (Launch button, or scroll).
     1  launch: parts slam together, ignition, the portal tears open from the pod
     2–4 the climb: a chase camera through the asteroid field; a fact card is
        pinned to a beacon rock at each stop
     5  climb aboard: the pod turns around to face you
     6  the hand-off into the cockpit (the reference's exact card-and-slide)
   In the cockpit the page scrolls normally again: down flies out to the footer.
   ===================================================================== */
const BEATS = [
  { hold: Infinity },          // 0 hero
  { dur: 2.8, hold: 4.2 },     // 1 launch → orbit
  { dur: 2.4, hold: 4.8 },     // 2 fact
  { dur: 2.4, hold: 4.8 },     // 3 fact
  { dur: 2.4, hold: 4.8 },     // 4 fact
  { dur: 2.4, hold: 3.6 },     // 5 climb aboard
  { dur: 4.6, back: 2.4 },     // 6 cockpit hand-off (linear clock; its parts carry their own eases)
];
const COCKPIT = 6;

const launch = $('#launch'), view = $('#view'), cockpitEl = $('#cockpit');
const stage = new Stage($('#gl'));
const world = space({ pod: false, constellation: false });
const { scene } = world;

// the asteroid field's horizon planet and gem rise in as you launch
const edge = world.edge, EDGE_Y = edge.position.y, gem = world.anchors.gem, GEM_S = gem.scale.x;
edge.position.y = EDGE_Y - 34; gem.scale.setScalar(0.001);

/* ------------------------------------------------ keyframes, one per beat
   cam/look: the camera · pod: where the pod sits · beacon: the rock its fact is pinned to */
const PI = Math.PI;
const K = [
  { cam: V(0, 0.4, 14), look: V(0, 0.15, 0), pod: V(0, -0.2, 0), s: 1.25, ry: -0.3, rx: 0, fov: 40 },
  { cam: V(0, 0, 24), look: V(0, 0, 0), pod: V(0, 0.2, 4), s: 2.6, ry: -0.1, rx: 0, fov: 40 },
  { cam: V(0, -1, -8), look: V(-0.6, 1.8, -36), pod: V(2.5, -2.2, -22), s: 1.45, ry: PI + 0.4, rx: 0.25, fov: 46, beacon: V(-6.4, 3.6, -34), side: 'l' },
  { cam: V(-1, 12, -48), look: V(0.6, 14.8, -76), pod: V(-3.5, 10.8, -62), s: 1.45, ry: PI - 0.4, rx: 0.25, fov: 46, beacon: V(6.4, 16.6, -74), side: 'r' },
  { cam: V(1, 25, -88), look: V(-0.6, 27.8, -116), pod: V(3.5, 23.8, -102), s: 1.45, ry: PI + 0.4, rx: 0.25, fov: 46, beacon: V(-6.4, 29.6, -114), side: 'l' },
  { cam: V(0, 38.4, -126), look: V(-0.8, 38.1, -140), pod: V(-3.6, 37.8, -140), s: 2.5, ry: PI * 2 + 0.5, rx: 0, fov: 40 },
];

/* ------------------------------------------------ the pod */
const podRig = new THREE.Group(), pod = makePod();
podRig.rotation.order = 'YXZ';
podRig.add(pod); scene.add(podRig);
const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.3, 20), toon({ shade: '#ff8a3d', base: '#ffd84a', light: '#fff6c2' }, { t1: -1 }));
flame.rotation.x = Math.PI; flame.position.y = -1.55; flame.userData.noInk = true; flame.visible = false; pod.add(flame);

/* the exploded view: the pod's parts pulled apart along a dashed assembly axis.
   makePod's children: body, window, window, glare, band, band, thruster, stalk, bead */
const [, winA, winB, glare, bandA, bandB, thruster, stalk, bead] = pod.children;
const PARTS = [
  { meshes: [winA, winB, glare], dir: V(0, 0.12, 1.15), anchor: V(-0.1, 0.5, 0.95) },     // canopy floats forward
  { meshes: [stalk, bead], dir: V(0.12, 0.95, 0), anchor: V(0.3, 1.4, 0) },               // antenna lifts up
  { meshes: [bandA, bandB], dir: V(0, -0.15, 0), spread: 0.22, anchor: V(0.96, -0.45, 0.2) }, // hull bands spread
  { meshes: [thruster], dir: V(0, -0.85, 0), anchor: V(0, -1.0, 0.25) },                    // thruster drops down
];
PARTS.forEach((pt) => pt.meshes.forEach((m) => { m.userData.home = m.position.clone(); }));
let explode = 1;
function setExplode(e, t) {
  explode = e;
  PARTS.forEach((pt, i) => pt.meshes.forEach((m, j) => {
    const breathe = 1 + Math.sin(t * 1.2 + i) * 0.04;
    m.position.copy(m.userData.home).addScaledVector(pt.dir, e * breathe);
    if (pt.spread) m.position.y += (j ? -1 : 1) * pt.spread * e;      // the two bands drift apart
  }));
}

// keep the middle of the launch frame clear of small floating rocks
scene.children.slice().forEach((o) => {
  if (o === podRig || !o.isMesh || o.userData.noInk) return;
  o.geometry.computeBoundingSphere();
  if (o.geometry.boundingSphere.radius * o.scale.x > 8) return;
  const q = o.position;
  if (Math.abs(q.x) < 10.5 && q.y > -4.5 && q.y < 4.8 && q.z > -14 && q.z < 12) scene.remove(o);
});

/* ------------------------------------------------ the climb: an asteroid corridor along the camera's path */
const R = rng(77);
const camPath = K.slice(1).map((k) => k.cam);
const pathAt = (z) => {
  for (let i = 0; i < camPath.length - 1; i++) {
    const A = camPath[i], B = camPath[i + 1];
    if (z <= A.z && z >= B.z) return V().lerpVectors(A, B, (A.z - z) / (A.z - B.z));
  }
  return (z > camPath[0].z ? camPath[0] : camPath[camPath.length - 1]).clone();
};
const ab = V(), ap = V();
const distSeg = (p, a, b) => { ab.subVectors(b, a); ap.subVectors(p, a); const t = clamp(ap.dot(ab) / ab.lengthSq()); return ap.sub(ab.multiplyScalar(t)).length(); };
// the lines of sight and flight paths that must stay clear
const CLEAR = [];
for (let i = 2; i <= 5; i++) {
  CLEAR.push([K[i].cam, K[i].pod, 3]);
  if (K[i].beacon) CLEAR.push([K[i].cam, K[i].beacon, 3.4]);
  CLEAR.push([K[i - 1].pod, K[i].pod, 2.6], [K[i - 1].cam, K[i].cam, 2.2]);
}
const flight = [];
const addRock = (p, s, seed, tone) => {
  const rk = makeRock({ seed, tone, squash: [1, 0.62 + R() * 0.45, 1] });
  rk.scale.setScalar(s); rk.position.copy(p); rk.rotation.set(R() * 6, R() * 6, R() * 6);
  rk.userData.spin = (R() - 0.5) * 0.5; scene.add(rk); flight.push(rk);
};
const STOPS = K.slice(2).map((k) => k.cam);
for (let i = 0, n = 0; i < 900 && n < 78; i++) {
  const z = -12 - R() * 152, c = pathAt(z), a = R() * PI * 2, rad = 4.5 + Math.pow(R(), 1.3) * 28;
  const p = V(c.x + Math.cos(a) * rad * 1.25, c.y + Math.sin(a) * rad * 0.85, z);
  const s = 0.3 + Math.pow(R(), 2.6) * 3;
  if (CLEAR.some(([A, B, r]) => distSeg(p, A, B) < r + s * 1.2)) continue;
  if (STOPS.some((q) => q.distanceTo(p) < 9 + s * 2)) continue;        // nothing huge right in front of a held view
  addRock(p, s, 100 + i, R() > 0.4 ? 'rock' : 'violet'); n++;
}
for (let i = 0; i < 8; i++) {                       // giants far out, for scale
  const z = -26 - i * 18 - R() * 8, c = pathAt(z), a = (i / 8) * PI * 2 + R();
  addRock(V(c.x + Math.cos(a) * 40, c.y + Math.sin(a) * 26, z - 20), 6 + R() * 5, 300 + i, i % 2 ? 'violet' : 'rock');
}
for (let i = 0; i < 26; i++) {                      // data shards drifting through
  const z = -14 - R() * 150, c = pathAt(z), a = R() * PI * 2, rad = 4 + R() * 16;
  const p = V(c.x + Math.cos(a) * rad * 1.3, c.y + Math.sin(a) * rad * 0.8, z);
  if (CLEAR.some(([A, B, r]) => distSeg(p, A, B) < r)) continue;
  const sh = makeShard({ tone: i % 4 === 0 ? 'lime' : 'crystal', len: 0.6 + R() * 1.1, w: 0.16 + R() * 0.1 });
  sh.position.copy(p); sh.rotation.set(R() * 6, R() * 6, R() * 6); sh.userData.spin = 0.4 + R() * 0.6; scene.add(sh); flight.push(sh);
}
// the beacon rocks the facts are pinned to
const beacons = [];
K.forEach((k, i) => {
  if (!k.beacon) return;
  const rock = makeRock({ seed: 600 + i, tone: 'violet', squash: [1.3, 0.7, 1] }); rock.scale.setScalar(1.35); rock.position.copy(k.beacon); scene.add(rock); flight.push(rock);
  const light = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 2), toon('lime', { rim: 0.3 })); light.position.copy(k.beacon).add(V(0, 1.3, 0)); scene.add(light); flight.push(light);
  beacons.push({ rock, light, beat: i, base: k.beacon.y, phase: i * 1.7 });
});

/* speed streaks: thin lines that rush past the camera while the pod is moving */
const STREAKS = 150, sPos = new Float32Array(STREAKS * 6), sSeed = [];
for (let i = 0; i < STREAKS; i++) sSeed.push({ a: R() * PI * 2, r: 2.2 + R() * 13, z: -R() * 72 });
const streakGeo = new THREE.BufferGeometry(); streakGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const streakMat = new THREE.LineBasicMaterial({ color: '#f6e8ff', transparent: true, opacity: 0, depthWrite: false, fog: false });
const streaks = new THREE.LineSegments(streakGeo, streakMat);
streaks.userData.noInk = true; streaks.frustumCulled = false; scene.add(streaks);
let speed = 0;

// sky and stars travel with the camera so the climb never reaches the edge of the sky
const followers = scene.children.filter((o) => o.isPoints || (o.isMesh && o.geometry.parameters && o.geometry.parameters.radius >= 250));

stage.setWorld(world);
// the hero is a clean sheet: the asteroid field only shows up once you launch
const fieldMeshes = scene.children.filter((o) => (o.isMesh || o.isGroup) && o !== podRig && o !== edge && !o.userData.noInk && !followers.includes(o) && !flight.includes(o));

/* life: rocks tumble, beacons pulse, streaks rush, the sky follows */
world.tick.push((dt, t) => {
  scene.children.forEach((o) => { if (o.userData.spin) { o.rotation.x += o.userData.spin * dt; o.rotation.y += o.userData.spin * dt * 0.7; } });
  beacons.forEach((bc) => {
    const y = bc.base + Math.sin(t * 0.6 + bc.phase) * 0.22;
    bc.rock.position.y = y; bc.light.position.y = y + 1.3; bc.light.scale.setScalar(1 + Math.sin(t * 3 + bc.phase) * 0.15);
  });
  const cam = stage.camera;
  followers.forEach((o) => o.position.copy(cam.position));
  streaks.position.copy(cam.position); streaks.quaternion.copy(cam.quaternion);
  const len = 0.3 + speed * 7;
  sSeed.forEach((s, i) => {
    s.z += speed * dt * 95; if (s.z > 2) s.z -= 74;
    const x = Math.cos(s.a) * s.r, y = Math.sin(s.a) * s.r * 0.7;
    sPos.set([x, y, s.z, x, y, s.z - len], i * 6);
  });
  streakGeo.attributes.position.needsUpdate = true;
  streakMat.opacity = speed * 0.7;
  streaks.visible = speed > 0.01;
});

/* ------------------------------------------------ the words */
const chars = (txt, from = 0) => {
  let i = from;
  return txt.split(' ').map((w) => `<span class="wd">${[...w].map((c) => `<span class="c" style="--i:${i++}">${c}</span>`).join('')}</span>`).join(' ');
};
const L1 = 'Interesting ideas drift in from everywhere.', L2 = 'I build the ones worth landing.';
const aboard = facts[3];
const beatsEl = document.createElement('div'); beatsEl.className = 'sbeats'; view.appendChild(beatsEl);
beatsEl.innerHTML = `
  <svg class="sring" viewBox="0 0 340 340" aria-hidden="true"><circle class="sring__dash" cx="170" cy="170" r="166"/><circle class="sring__solid" cx="170" cy="170" r="104" pathLength="1"/></svg>
  <span class="shock" aria-hidden="true"></span>
  <div class="sbeat sbeat--orbit" data-beat="1"><p class="sbeat__l">${chars(L1)}</p><p class="sbeat__r">${chars(L2, L1.length)}</p></div>
  <div class="sbeat sbeat--aboard" data-beat="5"><div class="sbeat__text"><p class="sbeat__eyebrow">${aboard.eyebrow}</p><p class="sbeat__title">${chars(aboard.title)}</p><p class="sbeat__body">${chars(aboard.body, aboard.title.length)}</p></div></div>
  <div class="signs">${beacons.map((bc, j) => {
    const f = facts[j];
    return `<div class="sign" data-beat="${bc.beat}" data-side="${K[bc.beat].side}"><div class="sign__card"><p class="eyebrow">${f.eyebrow}</p><p class="sign__title">${chars(f.title)}</p><p class="sign__body">${f.body}</p></div><span class="sign__leader"></span><span class="sign__ping"></span></div>`;
  }).join('')}</div>`;
const beatEls = [...beatsEl.querySelectorAll('.sbeat')], ring = beatsEl.querySelector('.sring'), shock = beatsEl.querySelector('.shock');
const signEls = [...beatsEl.querySelectorAll('.sign')];

/* ------------------------------------------------ cockpit (the site's doors) */
$('#track').innerHTML = pages.map((pg, i) => `
  <article class="window" data-world="${pg.world}"><div class="window__glass"><canvas aria-hidden="true"></canvas>
    <div class="window__copy"><div><h3>${pg.title}</h3><p>${pg.line}</p></div>
      <a class="btn btn--sm${i % 2 ? ' btn--light' : ''}" href="${pg.href}"><span class="btn__label">Enter</span></a>
    </div></div></article>`).join('');
const cockpit = mountCockpit(cockpitEl, { dots: $('#dots'), start: 1, auto: reduced ? 0 : 4500 }), cockpitStages = cockpit.stages;
const footer = $('.space-footer');
// in the cockpit the page scrolls again, smoothed (the story itself never scrolls)
const lenis = reduced ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });

/* ------------------------------------------------ the director */
const section = $('.launch'), mission = $('#mission'), barSegs = [...$('#bar').children], cut = $('#cut');
let scrollScreens = 0, atTopSince = performance.now();
const readScroll = () => {
  scrollScreens = Math.max(0, -section.getBoundingClientRect().top / innerHeight);
  if (scrollY > 1) atTopSince = 0; else if (!atTopSince) atTopSince = performance.now();
};
addEventListener('scroll', readScroll, { passive: true });
addEventListener('resize', readScroll);

let b = 0, settled = 0, settledAt = performance.now(), autoplay = false, locked = false;
const tw = { from: 0, to: 0, t0: 0, dur: 0, lin: false };
const isMoving = () => (performance.now() - tw.t0) / 1000 < tw.dur;
function lock(on) {
  locked = on;
  document.documentElement.classList.toggle('is-locked', on);
  if (on) { lenis?.stop(); lenis?.scrollTo(0, { immediate: true }); scrollTo(0, 0); } else lenis?.start();
}
lock(true);
function startMove(from, to) {
  const fwd = to > from;
  tw.from = from; tw.to = to; tw.t0 = performance.now();
  tw.dur = reduced ? 0.001 : fwd ? BEATS[to].dur : from === COCKPIT ? BEATS[COCKPIT].back : from === 1 ? 1.8 : 1.7;
  tw.lin = Math.max(from, to) === COCKPIT;
  if (fwd && to === COCKPIT) cockpit.arrive(reduced ? 0 : 1000);
  if (from === COCKPIT) lock(true);
}
function step(dir) {
  if (isMoving()) return;
  const cur = Math.round(b), n = clamp(cur + dir, 0, COCKPIT);
  if (n === cur) return;
  if (n >= 1 && dir > 0) autoplay = !reduced;
  startMove(cur, n);
}
function skip() {                                   // cut to the last story beat, then play the hand-off
  if (tw.to === COCKPIT) return;
  autoplay = false;
  cut.classList.add('on');
  setTimeout(() => { tw.from = tw.to = 5; tw.t0 = 0; tw.dur = 0; b = 5; startMove(5, COCKPIT); cut.classList.remove('on'); }, reduced ? 0 : 380);
}
if (import.meta.env.DEV) window.__seek = (v) => { autoplay = false; tw.from = tw.to = v; tw.t0 = 0; tw.dur = 0; };   // dev: freeze the mission at any point
$('#launch-btn').addEventListener('click', () => step(1));
$('#skip').addEventListener('click', skip);

// input: one gesture = one beat
let acc = 0, accT = 0;
addEventListener('wheel', (e) => {
  if (!locked) {
    // back up into the story from the top of the cockpit
    if (scrollY <= 1 && e.deltaY < -10 && Math.abs(e.deltaY) > Math.abs(e.deltaX) && atTopSince && performance.now() - atTopSince > 400) { e.preventDefault(); step(-1); }
    return;
  }
  e.preventDefault();
  const now = performance.now();
  if (now - accT > 240) acc = 0;
  accT = now; acc += e.deltaY;
  if (Math.abs(acc) > 34) { step(Math.sign(acc)); acc = 0; }
}, { passive: false });
let touchY = null;
addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', (e) => { if (locked) e.preventDefault(); }, { passive: false });
addEventListener('touchend', (e) => {
  if (touchY === null) return;
  const dy = touchY - e.changedTouches[0].clientY; touchY = null;
  if (Math.abs(dy) < 40) return;
  if (locked) step(Math.sign(dy));
  else if (scrollY <= 1 && dy < 0 && atTopSince && performance.now() - atTopSince > 400) step(-1);
});
addEventListener('keydown', (e) => {
  if (!locked || e.altKey || e.metaKey || e.ctrlKey) return;
  const onControl = e.target.closest && e.target.closest('button, a, input, textarea');
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !onControl)) { e.preventDefault(); step(1); }
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
});

/* ------------------------------------------------ every frame */
let last = performance.now(), clock = 0, hop = 0, downX = 0, downY = 0, prevH = 0, fov = 40;
const size = { w: innerWidth, h: innerHeight, foot: 0 };      // measured on resize, never mid-frame
const measure = () => { size.w = view.clientWidth; size.h = view.clientHeight; size.foot = section.offsetHeight - innerHeight; };
new ResizeObserver(measure).observe(view); new ResizeObserver(measure).observe(section); measure();
const W = () => size.w, H = () => size.h;
const css = (el, k, v) => { if (el.style[k] !== v) el.style[k] = v; };   // only touch styles that change
function card(el, ins, sc, x) {
  // el shown as a rounded card: screen inset `ins`px, content scale `sc`, slid `x`px
  const w = W(), h = H(), I = Math.min(w * 0.105, h * 0.2) * ins, r = Math.min(w * 0.105, h * 0.2) * 0.75 * ins;
  const ix = w / 2 - (w / 2 - I) / sc, iy = h / 2 - (h / 2 - I) / sc;
  css(el, 'transform', `translate3d(${x.toFixed(1)}px, 0px, 0px) scale(${sc.toFixed(4)})`);
  css(el, 'clipPath', ins > 0.001 ? `inset(${iy.toFixed(1)}px ${ix.toFixed(1)}px round ${(r / sc).toFixed(1)}px)` : 'none');
}

function frame(now) {
  requestAnimationFrame(frame);
  lenis?.raf(now);
  const dt = Math.min(0.1, (now - last) / 1000); last = now; clock += dt;

  /* the clock: where on the mission are we? */
  const k = tw.dur ? clamp((now - tw.t0) / 1000 / tw.dur) : 1;
  b = tw.from + (tw.to - tw.from) * (tw.lin ? k : easeInOut(k));
  const moving = k < 1;
  if (!moving && settled !== tw.to) { settled = tw.to; settledAt = now; if (settled === COCKPIT) lock(false); }
  if (!moving && autoplay && settled >= 1 && settled < COCKPIT && now - settledAt > BEATS[settled].hold * 1000) startMove(settled, settled + 1);
  const on = moving ? -1 : settled;

  /* hero → launch */
  const h = seg(b, 0, 1);
  launch.style.setProperty('--p', (h * 0.12).toFixed(4));
  const intro = reduced ? 1 : clamp((now - T0) / 1000 / 2.6);
  const flyIn = 1 + (1 - easeOut(seg(intro, 0.05, 0.8))) * 2.4;      // on load the parts fly in to their exploded places
  const slam = easeIn(seg(h, 0.02, 0.24));                              // launching slams them together…
  setExplode(flyIn * (1 - slam) + 0.07 * bump(seg(h, 0.24, 0.42)), clock); // …and they bounce once
  if (prevH < 0.25 && h >= 0.25 && !reduced) { shock.classList.remove('go'); void shock.offsetWidth; shock.classList.add('go'); }
  prevH = h;
  const open = smooth(seg(h, 0.26, 0.66));                              // the portal tears open from the pod
  updatePortal(dt, h, open);
  const showField = h > 0.3, showClimb = b > 1.04;            // the corridor only exists once the climb starts
  if (fieldMeshes[0] && fieldMeshes[0].visible !== showField) fieldMeshes.forEach((o) => { o.visible = showField; });
  if (flight[0].visible !== showClimb) flight.forEach((o) => { o.visible = showClimb; });
  const rise = smooth(seg(h, 0.3, 1));
  edge.position.y = EDGE_Y - 34 * (1 - rise); gem.scale.setScalar(Math.max(0.001, GEM_S * rise));
  scene.fog.near = lerp(30, 40, h); scene.fog.far = lerp(62, 150, h);

  /* camera and pod, between two keyframes */
  let i = Math.min(Math.floor(b), 4), f = b - i;
  if (b >= 5) { i = 4; f = 1; }
  const A = K[i], B = K[i + 1];
  let fc, fp, swerve = 0, rush = 0;
  if (i === 0) { fc = easeInOut(seg(f, 0.32, 1)); fp = easeInOut(seg(f, 0.3, 1)); rush = bump(seg(f, 0.4, 1)) * 0.5; }
  else { fp = clamp(f * 1.12); fc = clamp(f * 1.12 - 0.12); swerve = bump(f) * (i % 2 ? 1 : -1); rush = bump(f); }
  speed = moving && b < 5 ? rush : 0;
  world.P.lerpVectors(A.cam, B.cam, fc); world.L.lerpVectors(A.look, B.look, fc);
  world.P.x += swerve * 0.7;
  const shake = 0.12 * bump(seg(h, 0.24, 0.62)) + 0.035 * speed;
  world.P.x += Math.sin(clock * 53) * shake; world.P.y += Math.cos(clock * 47) * shake;
  world.swayK = lerp(1, 0.55, smooth(h));
  const wantFov = lerp(A.fov, B.fov, fc) + speed * 10 + (i === 0 ? bump(seg(f, 0.3, 0.9)) * 4 : 0);
  if (Math.abs(wantFov - fov) > 0.01) { fov = wantFov; stage.camera.fov = fov; stage.camera.updateProjectionMatrix(); }

  podRig.position.lerpVectors(A.pod, B.pod, fp);
  const xk = b > 1 ? clamp(size.w / size.h / 1.6, 0.3, 1) : 1;          // portrait screens: pull the pod toward the middle
  podRig.position.x = world.P.x + (podRig.position.x - world.P.x) * xk;
  podRig.position.x += swerve * 1.7 * xk;
  podRig.position.y += (1 - xk) * 2.6 * smooth(seg(b, 4, 5));        // portrait: lift the pod above the last caption
  podRig.position.y += bump(fp) * (i === 0 ? 0.6 : 1.1);
  podRig.scale.setScalar(lerp(A.s, B.s, fp) * (0.55 + 0.45 * xk));      // …and a little smaller there
  let ry = lerp(A.ry, B.ry, fp), rx = lerp(A.rx, B.rx, fp) + speed * 0.35;
  const heroK = 1 - smooth(h), ps = stage.pointerSmooth;
  ry += heroK * (Math.sin(clock * 0.35) * 0.35 + ps.x * 0.55);         // the drawing turns toward your cursor
  rx += heroK * -ps.y * 0.2;
  podRig.rotation.set(rx, ry, -swerve * 0.5);
  hop = Math.max(0, hop - dt * 2.2);
  pod.position.y = (b > 0.6 ? Math.sin(clock * 0.8) * 0.06 : 0) + (b < 0.05 ? Math.sin(hop * Math.PI) * 0.5 : 0);
  pod.rotation.z = b > 0.6 ? Math.sin(clock * 0.55) * 0.05 : 0;
  flame.visible = h > 0.22 && b < 5.98;
  flame.scale.set(1 + speed * 0.3, 0.8 + speed * 1.3 + bump(seg(h, 0.22, 0.8)) * 0.8 + Math.sin(clock * 40) * 0.2, 1 + speed * 0.3);
  flame.position.y = -0.98 - 0.65 * flame.scale.y;                      // the flame hangs from the thruster ring, whatever its length

  /* words */
  beatEls.forEach((el) => el.classList.toggle('on', +el.dataset.beat === on));
  signEls.forEach((el) => el.classList.toggle('on', +el.dataset.beat === on));
  ring.classList.toggle('on', on === 1);

  /* the mission bar: one segment per beat, filling while it holds */
  mission.classList.toggle('on', locked && b > 0.6 && b < 5.2);
  barSegs.forEach((sg, j) => {
    const beat = j + 1;
    let fill = settled > beat || (moving && tw.to > beat) ? 1 : 0;
    if (beat === settled && !moving) fill = autoplay ? clamp((now - settledAt) / 1000 / BEATS[beat].hold) : 1;
    if (moving && tw.to === beat) fill = 0;
    sg.style.setProperty('--f', fill.toFixed(3));
  });

  /* beat 6: the hand-off (reference recipe, timed in seconds on a linear clock)
       0.0–1.1  the view insets to a rounded card and shrinks a touch
       0.8–3.1  both cards slide left a full screen: space out, cockpit in
       3.1–4.6  the cockpit card grows back to full screen                  */
  const T = clamp(b - 5) * BEATS[COCKPIT].dur;
  const a = easeInOut(seg(T, 0, 1.1)), sl = easeInOut(seg(T, 0.8, 3.1)), c = easeInOut(seg(T, 3.1, 4.6));
  /* then, scrolling: the cockpit holds for a short stretch (0–0.35 screens), then you fly out through
     the centre window (0.35–1.5). The footer waits pinned underneath the stage, so the zooming cockpit
     dissolves straight into it: no gap, no black veil. */
  const out = b >= 6 ? seg(scrollScreens, 0.35, 1.5) : 0;
  const zoom = easeInOut(seg(out, 0, 0.7)), fade = smooth(seg(out, 0.5, 0.95)), arrive = smooth(seg(out, 0.45, 1));   // through the glass first, then the window's space becomes the footer's
  if (T > 0) {
    card(view, a, 1 - 0.09 * a, -W() * sl);
    if (b < 6) card(cockpitEl, 1 - c, 0.91 + 0.09 * c, W() * (1 - sl));
    else { css(cockpitEl, 'transform', `scale(${(1 + zoom * 1.75).toFixed(4)})`); css(cockpitEl, 'clipPath', 'none'); }
  } else {
    css(view, 'transform', 'none'); css(view, 'clipPath', 'none');
  }
  css(cockpitEl, 'visibility', b > 5.02 && fade < 1 ? 'visible' : 'hidden');
  cockpitEl.style.opacity = b > 5.02 ? (1 - fade).toFixed(3) : 0;
  cockpitEl.classList.toggle('is-live', b >= 6 && out < 0.2);
  launch.classList.toggle('is-out', b >= 6 && out > 0);         // the stage turns see-through as you leave
  const pin = Math.max(0, size.foot - scrollY);                   // keep the footer parked under the stage
  css(footer, 'transform', pin > 0.5 ? `translate3d(0px, ${(-pin).toFixed(1)}px, 0px)` : 'none');
  footer.style.setProperty('--arrive', (b >= 6 ? arrive : 0).toFixed(3));
  footerStage.paused = !(b >= 6 && out > 0.2);
  if (b < 5) cockpit.jump(1);                          // park on Work, the window you arrive at
  cockpit.setAuto(b >= 6 && out < 0.2);               // the wall loops only while you're in the cockpit
  stage.paused = b > 5.72;
  cockpitStages.forEach((s) => { s.paused = b < 5.02 || fade > 0.99; });
}

/* ------------------------------------------------ the portal: your cursor looks into the shipped version
   The hero is a BLUEPRINT; the portal shows it SHIPPED (full colour). Click drops a portal that
   stays open. Launching tears one open from the pod itself, over everything. */
const canvas = $('#gl');
const mask = document.createElement('canvas'), mctx = mask.getContext('2d');
const maskTex = new THREE.CanvasTexture(mask); maskTex.minFilter = THREE.LinearFilter; maskTex.generateMipmaps = false;
const portals = [];
const cur = { x: 0.62, y: 0.55, tx: 0.62, ty: 0.55, r: 0, on: false };
const podS = { x: 0.5, y: 0.55 };                     // the pod on screen (0..1), from the last frame
function sizeMask() { mask.width = Math.round(canvas.clientWidth / 3); mask.height = Math.round(canvas.clientHeight / 3); }
sizeMask(); addEventListener('resize', sizeMask);
function blob(x, y, r, t, seed) {                     // a wobbly, gooey circle
  mctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const k = 1 + Math.sin(a * 3 + t * 2.2 + seed) * 0.05 + Math.sin(a * 5 - t * 1.7 + seed * 2) * 0.035;
    const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k;
    i ? mctx.lineTo(px, py) : mctx.moveTo(px, py);
  }
  mctx.fill();
}
function drawMask(t, open) {
  const w = mask.width, h = mask.height;
  mctx.filter = 'none'; mctx.fillStyle = '#000'; mctx.fillRect(0, 0, w, h);
  mctx.filter = 'blur(2px)'; mctx.fillStyle = '#fff';
  const Rr = Math.min(w, h) * 0.2;
  portals.forEach((pt, i) => blob(pt.x * w, pt.y * h, pt.r * Rr, t, i + 1));
  if (cur.r > 0.01) blob(cur.x * w, cur.y * h, cur.r * Rr, t, 0);
  if (open > 0) blob(podS.x * w, podS.y * h, open * Math.hypot(w, h) * 1.1, t, 9);
  maskTex.needsUpdate = true;
}
canvas.addEventListener('pointermove', (e) => {
  const rc = canvas.getBoundingClientRect();
  cur.tx = (e.clientX - rc.left) / rc.width; cur.ty = (e.clientY - rc.top) / rc.height; cur.on = true;
});
canvas.addEventListener('pointerleave', () => { cur.on = false; });
canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
canvas.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6 || b > 0.03) return;
  const rc = canvas.getBoundingClientRect(), ndc = new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, stage.camera);
  if (ray.intersectObject(pod, true).length) { hop = 1; return; }    // the pod hops when poked
  portals.push({ x: cur.x, y: cur.y, r: 0.001 }); if (portals.length > 6) portals.shift();
});
let portalClock = 0;
function updatePortal(dt, h, open) {
  portalClock += dt;
  const k = 1 - Math.exp(-dt * 9);
  cur.x += (cur.tx - cur.x) * k; cur.y += (cur.ty - cur.y) * k;
  cur.r += ((cur.on && h < 0.02 ? 1 : 0) - cur.r) * (1 - Math.exp(-dt * 6));
  portals.forEach((pt) => { pt.r += (1 - pt.r) * (1 - Math.exp(-dt * 5)); });
  const v = open >= 0.999 ? 'shipped' : 'blueprint';
  if (v === 'blueprint') drawMask(portalClock, open);
  stage.setView(v, { lens: 'shipped', mask: v === 'blueprint' ? maskTex : null });
  const Rpx = Math.max(cur.r * Math.min(canvas.clientWidth, canvas.clientHeight) * 0.2, 0);
  const useLaunch = open > 0;
  const px = useLaunch ? podS.x : cur.x, py = useLaunch ? podS.y : cur.y;
  const rr = useLaunch ? open * Math.hypot(canvas.clientWidth, canvas.clientHeight) * 1.1 : Rpx;
  launch.style.setProperty('--px', (px * 100).toFixed(2) + '%'); launch.style.setProperty('--py', (py * 100).toFixed(2) + '%');
  launch.style.setProperty('--pr', rr.toFixed(1) + 'px');
  if (document.documentElement.dataset.view !== v) document.documentElement.dataset.view = v;
}

/* ------------------------------------------------ blueprint callouts (hero) */
const CALLOUTS = [
  { part: 0, dx: -1, dy: -0.25, n: '01', t: 'Canopy · designer', b: 'Sees it before it exists' },
  { part: 1, dx: 1, dy: 0.62, n: '02', t: 'Antenna · curious', b: 'Always tuned to the next idea' },
  { part: 2, dx: 1, dy: 0.05, n: '03', t: 'Hull · developer', b: 'Builds things that hold up' },
  { part: 3, dx: -1, dy: -0.25, n: '04', t: 'Thruster · ships it', b: 'From idea to launch' },
];
const calloutSvg = $('#callouts'), calloutBox = $('#callout-labels');
const NS = 'http://www.w3.org/2000/svg';
const calloutEls = CALLOUTS.map((c, i) => {
  const g = document.createElementNS(NS, 'g');
  g.style.setProperty('--d', `${1.15 + i * 0.16}s`);
  const line = document.createElementNS(NS, 'polyline'), dot = document.createElementNS(NS, 'circle');
  line.setAttribute('pathLength', '1');
  dot.setAttribute('r', '4'); g.append(line, dot); calloutSvg.appendChild(g);
  const label = document.createElement('div'); label.className = 'callout' + (c.dx < 0 ? ' callout--left' : '');
  label.style.setProperty('--d', `${1.45 + i * 0.16}s`);
  label.innerHTML = '<b>' + c.n + '</b><span><strong>' + c.t + '</strong>' + c.b + '</span>';
  calloutBox.appendChild(label);
  return { line, dot, label };
});
const cw = V();
const axis = document.createElementNS(NS, 'line'); axis.setAttribute('class', 'axis'); calloutSvg.prepend(axis);
const dim = document.createElementNS(NS, 'g'); dim.setAttribute('class', 'dim');
dim.innerHTML = '<line class="dim__l"/><line class="dim__a"/><line class="dim__b"/><text class="dim__t">SCALE 1:1</text>';
calloutSvg.prepend(dim);
const ax1 = V(), ax2 = V(), dl = V(), dr = V();
function drawCallouts(s) {
  const w = s.canvas.clientWidth, hh = s.canvas.clientHeight;
  calloutSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + hh);
  pod.updateMatrixWorld(true);
  CALLOUTS.forEach((c, i) => {
    const pt = PARTS[c.part]; cw.copy(pt.anchor).addScaledVector(pt.dir, explode); pod.localToWorld(cw); cw.project(s.camera);
    const ax = (cw.x * 0.5 + 0.5) * w, ay = (-cw.y * 0.5 + 0.5) * hh;
    const reach = Math.min(w * 0.17, 260), ex = ax + c.dx * reach, ey = ay + c.dy * reach * 0.6;
    const kx = ax + c.dx * reach * 0.35;
    calloutEls[i].line.setAttribute('points', ax + ',' + ay + ' ' + kx + ',' + ey + ' ' + ex + ',' + ey);
    calloutEls[i].dot.setAttribute('cx', ax); calloutEls[i].dot.setAttribute('cy', ay);
    calloutEls[i].label.style.transform = 'translate(' + ex + 'px, ' + ey + 'px)';
  });
  const toS = (v) => { v.project(s.camera); return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * hh]; };
  const [x1, y1] = toS(pod.localToWorld(ax1.set(0, 1.9 + explode, 0)));
  const [x2, y2] = toS(pod.localToWorld(ax2.set(0, -1.6 - explode, 0)));
  axis.setAttribute('x1', x1); axis.setAttribute('y1', y1); axis.setAttribute('x2', x2); axis.setAttribute('y2', y2);
  const [lx, ly] = toS(pod.localToWorld(dl.set(-1, -1.35 - explode * 0.6, 0)));
  const [rx] = toS(pod.localToWorld(dr.set(1, -1.35 - explode * 0.6, 0)));
  const q = dim.children;
  q[0].setAttribute('x1', lx); q[0].setAttribute('x2', rx); q[0].setAttribute('y1', ly); q[0].setAttribute('y2', ly);
  q[1].setAttribute('x1', lx); q[1].setAttribute('x2', lx); q[1].setAttribute('y1', ly - 8); q[1].setAttribute('y2', ly + 8);
  q[2].setAttribute('x1', rx); q[2].setAttribute('x2', rx); q[2].setAttribute('y1', ly - 8); q[2].setAttribute('y2', ly + 8);
  q[3].setAttribute('x', (lx + rx) / 2); q[3].setAttribute('y', ly - 10);
}

/* the ring, the shockwave and the captions follow the pod on screen; the cards follow their beacons */
const pc = V(), pr = V(), fv = V();
stage.onFrame = (s) => {
  if (b < 0.4) drawCallouts(s);
  const w = s.canvas.clientWidth, hh = s.canvas.clientHeight;
  pod.getWorldPosition(pc);
  pr.setFromMatrixColumn(s.camera.matrixWorld, 0).multiplyScalar(podRig.scale.x).add(pc);
  pc.project(s.camera); pr.project(s.camera);
  podS.x = pc.x * 0.5 + 0.5; podS.y = -pc.y * 0.5 + 0.5;
  beatsEl.style.setProperty('--rx', (podS.x * w).toFixed(1) + 'px');
  beatsEl.style.setProperty('--ry', (podS.y * hh).toFixed(1) + 'px');
  beatsEl.style.setProperty('--rr', Math.abs((pr.x - pc.x) * 0.5 * w).toFixed(1) + 'px');
  beacons.forEach((bc, j) => {
    fv.copy(bc.light.position).project(s.camera);
    const el = signEls[j];
    el.style.visibility = fv.z < 1 ? '' : 'hidden';
    el.style.translate = `${((fv.x * 0.5 + 0.5) * w).toFixed(1)}px ${((-fv.y * 0.5 + 0.5) * hh).toFixed(1)}px`;
  });
};

requestAnimationFrame(frame);

/* footer: a quiet stretch of the asteroid field; the cards are pinned to rocks with lime beacons */
let footerStage;
{
  const fStage = footerStage = new Stage($('#footer-gl'), { dpr: 1.5 });
  const fWorld = space({ pod: false, constellation: false });
  const SPOTS = [V(-9.4, -4.4, 0), V(0, -5.6, 2.5), V(9.4, -4.4, 0)];
  fWorld.edge.position.set(0, -45, -10);                                  // the planet becomes a horizon along the bottom
  fWorld.scene.remove(fWorld.anchors.gem);
  fWorld.scene.children.slice().forEach((o) => {
    if (!o.isMesh || o.userData.noInk) return;
    o.geometry.computeBoundingSphere();
    if (o.geometry.boundingSphere.radius * o.scale.x > 8) return;
    if (SPOTS.some((s) => o.position.distanceTo(s) < 6.5) || (Math.abs(o.position.x) < 14 && o.position.y > 0 && o.position.z > -45)) fWorld.scene.remove(o);   // keep the headline clear
  });
  const fBeacons = SPOTS.map((s, i) => {
    const rock = makeRock({ seed: 500 + i, tone: 'violet', squash: [1.25, 0.75, 1] }); rock.scale.setScalar(1.25); rock.position.copy(s); fWorld.scene.add(rock);
    const light = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 2), toon('lime', { rim: 0.3 })); light.position.copy(s).add(V(0, 1.2, 0)); fWorld.scene.add(light);
    return { rock, light, base: s.y, phase: i * 1.7 };
  });
  const fPod = makePod(); fPod.scale.setScalar(2.2); fPod.position.set(-15.5, 9.5, -14); fPod.rotation.y = 0.6; fWorld.scene.add(fPod);   // parked up in the corner, clear of the cards
  fWorld.tick.push((dt, t) => { fPod.position.y = 9.5 + Math.sin(t * 0.7) * 0.35; fPod.rotation.z = Math.sin(t * 0.5) * 0.05; });
  fWorld.tick.push((dt, t) => fBeacons.forEach((bc) => {
    const y = bc.base + Math.sin(t * 0.6 + bc.phase) * 0.25;
    bc.rock.position.y = y; bc.light.position.y = y + 1.2; bc.light.scale.setScalar(1 + Math.sin(t * 3 + bc.phase) * 0.15);
    bc.rock.rotation.y += dt * 0.08;
  }));
  fStage.setWorld(fWorld);
  const cards = [...document.querySelectorAll('#footer-cards .fcard')], fp = V();
  fStage.onFrame = (s) => {
    const w = s.canvas.clientWidth, hh = s.canvas.clientHeight;
    cards.forEach((el, i) => {
      fp.copy(fBeacons[i].light.position).project(s.camera);
      el.style.transform = 'translate(' + ((fp.x * 0.5 + 0.5) * w) + 'px, ' + ((-fp.y * 0.5 + 0.5) * hh) + 'px) translate(-50%, -100%)';
    });
  };
}

/* footer: back to the top (and back into the story) */
document.querySelectorAll('[data-top]').forEach((bt) => bt.addEventListener('click', () => (lenis ? lenis.scrollTo(0, { duration: 1.6 }) : scrollTo(0, 0))));
reveal();
