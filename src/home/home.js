import * as THREE from 'three';
import { mountGrain } from '../ds/grain.js';
import { Stage } from '../ds/toon/stage.js';
import { space } from '../ds/toon/worlds.js';
import { makePod, makeRock } from '../ds/toon/props.js';
import { toon } from '../ds/toon/materials.js';
import { mountCockpit } from '../ds/cockpit.js';
import { pageTransitions, reveal } from '../ds/transitions.js';
import { pages, facts } from '../content.js';

mountGrain();
pageTransitions();

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = THREE.MathUtils.lerp;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const V = (...a) => new THREE.Vector3(...a);

/* =====================================================================
   THE SEQUENCE: stepped like the reference. Every ~screen of scroll is one
   beat; reaching a new beat plays a timed, eased move (not scrubbed), then holds.
     0  hero: the blueprint sheet, the pod in exploded view
     1  launch: the portal opens, the pod assembles, a lime ring locks on
     2–5 the pod swings side to side; facts about you appear opposite it
     6  the view shrinks to a card and the cockpit slides in
   After that: the cockpit holds, then you fly out through its window to the footer.
   ===================================================================== */
const LAST_BEAT = 6;
const launch = $('#launch'), view = $('#view'), cockpitEl = $('#cockpit');
const stage = new Stage($('#gl'));
const world = space({ pod: false, constellation: false });
const { scene } = world;

// the asteroid field's horizon planet and gem rise in as you launch
const edge = world.edge, EDGE_Y = edge.position.y, gem = world.anchors.gem, GEM_S = gem.scale.x;
edge.position.y = EDGE_Y - 34; gem.scale.setScalar(0.001);

/* ------------------------------------------------ the pod */
const podRig = new THREE.Group(), pod = makePod();
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

// keep the middle of the frame clear of small floating rocks
scene.children.slice().forEach((o) => {
  if (o === podRig || !o.isMesh || o.userData.noInk) return;
  o.geometry.computeBoundingSphere();
  if (o.geometry.boundingSphere.radius * o.scale.x > 8) return;
  const q = o.position;
  if (Math.abs(q.x) < 10.5 && q.y > -4.5 && q.y < 4.8 && q.z > -14 && q.z < 12) scene.remove(o);
});
stage.setWorld(world);
// the hero is a clean sheet: the asteroid field only shows up once you launch
const fieldMeshes = scene.children.filter((o) => (o.isMesh || o.isGroup) && o !== podRig && o !== edge && !o.userData.noInk && !(o.geometry && o.geometry.parameters && o.geometry.parameters.radius > 100));

/* ------------------------------------------------ keyframes, one per beat */
const CAM_HERO = { pos: V(0, 0.4, 14), look: V(0, 0.15, 0) };
const CAM_FLY = { pos: V(0, 0, 24), look: V(0, 0, 0) };
const KEYS = [
  { pos: V(0, -0.55, 0), s: 1.6, ry: -0.3 },     // 0 hero (exploded, on the sheet)
  { pos: V(0, 0.2, 4), s: 2.6, ry: -0.1 },       // 1 centred, ring locks on
  { pos: V(5.6, -0.3, 6), s: 3.3, ry: -0.65 },   // 2 right, text left
  { pos: V(-5.6, -0.3, 6), s: 3.3, ry: 0.55 },   // 3 left, text right
  { pos: V(5.2, 0.4, 7), s: 3.0, ry: -0.9 },     // 4 right, text left
  { pos: V(-5.2, 0.3, 7), s: 3.0, ry: 0.35 },    // 5 left and close: climb aboard
  { pos: V(-5.2, 0.3, 7), s: 3.0, ry: 0.35 },      // 6 (the card swap plays over this)
];

/* ------------------------------------------------ the words, beat by beat */
const words = (txt) => txt.split(' ').map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`).join(' ');
const beatsEl = document.createElement('div'); beatsEl.className = 'sbeats'; view.appendChild(beatsEl);
beatsEl.innerHTML = `
  <svg class="sring" viewBox="0 0 340 340" aria-hidden="true"><circle class="sring__dash" cx="170" cy="170" r="166"/><circle class="sring__solid" cx="170" cy="170" r="104" pathLength="1"/></svg>
  <div class="sbeat sbeat--orbit" data-beat="1"><p class="sbeat__l">${words('Interesting ideas drift in from everywhere.')}</p><p class="sbeat__r">${words('I build the ones worth landing.')}</p></div>
  ${facts.map((f, i) => `<div class="sbeat sbeat--${i % 2 ? 'right' : 'left'}" data-beat="${i + 2}"><div class="sbeat__card"><p class="sbeat__eyebrow">${f.eyebrow}</p><p class="sbeat__title">${words(f.title)}</p><p class="sbeat__body">${words(f.body)}</p></div></div>`).join('')}`;
const beatEls = [...beatsEl.querySelectorAll('.sbeat')], ring = beatsEl.querySelector('.sring');

/* ------------------------------------------------ cockpit (the site's doors) */
$('#track').innerHTML = pages.map((pg, i) => `
  <article class="window" data-world="${pg.world}"><div class="window__glass"><canvas aria-hidden="true"></canvas>
    <div class="window__copy"><div><h3>${pg.title}</h3><p>${pg.line}</p></div>
      <a class="btn btn--sm${i % 2 ? ' btn--light' : ''}" href="${pg.href}"><span class="btn__label">Enter</span></a>
    </div></div></article>`).join('');
const cockpit = mountCockpit(cockpitEl, { dots: $('#dots'), start: 1 }), cockpitStages = cockpit.stages;
const outVeil = document.createElement('div'); outVeil.className = 'launch__out'; launch.appendChild(outVeil);

/* ------------------------------------------------ scroll → beats */
const section = $('.launch');
let scrollScreens = 0;                                 // how many screens into the section
const readScroll = () => { scrollScreens = Math.max(0, -section.getBoundingClientRect().top / innerHeight); };
addEventListener('scroll', readScroll, { passive: true });
addEventListener('resize', readScroll);
readScroll();

let b = 0, step = 0, sw = 0, last = performance.now(), clock = 0, hop = 0, downX = 0, downY = 0;
const tw = { from: 0, to: 0, t0: -1e9, dur: 1.6 };
function goToBeat(n) {
  if (n === tw.to) return;
  tw.from = b; tw.to = n; tw.t0 = performance.now();
  tw.dur = reduced ? 0.001 : 1.5 + 0.35 * (Math.abs(n - b) - 1);    // a longer jump takes a little longer
}
step = clamp(Math.floor(scrollScreens + 0.3), 0, LAST_BEAT); b = tw.from = tw.to = step;

const tmpA = V();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now; clock += dt;

  // which beat does the scroll position ask for? then glide there on a fixed, eased clock
  step = clamp(Math.floor(scrollScreens + 0.3), 0, LAST_BEAT);
  goToBeat(step);
  const k = clamp((now - tw.t0) / 1000 / tw.dur);
  b = tw.from + (tw.to - tw.from) * easeInOut(k);
  const moving = k < 1;

  const h0 = clamp(b);                                    // hero → launch
  launch.style.setProperty('--p', (h0 * 0.12).toFixed(4));
  updatePortal(dt, h0);
  setExplode(1 - smooth(seg(b, 0, 0.6)), clock);
  const showField = b > 0.25;
  if (fieldMeshes[0] && fieldMeshes[0].visible !== showField) fieldMeshes.forEach((o) => { o.visible = showField; });
  edge.position.y = EDGE_Y - 34 * (1 - smooth(h0)); gem.scale.setScalar(Math.max(0.001, GEM_S * smooth(h0)));
  scene.fog.near = lerp(30, 40, h0); scene.fog.far = lerp(62, 140, h0);

  /* camera */
  world.P.lerpVectors(CAM_HERO.pos, CAM_FLY.pos, smooth(h0)); world.L.lerpVectors(CAM_HERO.look, CAM_FLY.look, smooth(h0));
  world.swayK = 1;

  /* pod: between two keyframes, with a little lift and a bank into the move */
  const i = Math.min(Math.floor(b), KEYS.length - 2), f = b - i, A = KEYS[i], B = KEYS[i + 1];
  podRig.position.lerpVectors(A.pos, B.pos, f);
  podRig.position.y += Math.sin(f * Math.PI) * 0.9 * (i > 0 ? 1 : 0);
  podRig.scale.setScalar(lerp(A.s, B.s, f));
  const dir = Math.sign(B.pos.x - A.pos.x);
  podRig.rotation.set(0, lerp(A.ry, B.ry, f), -Math.sin(f * Math.PI) * 0.2 * dir);
  hop = Math.max(0, hop - dt * 2.2);
  pod.position.y = (b > 0.6 ? Math.sin(clock * 0.8) * 0.06 : 0) + (b < 0.05 ? Math.sin(hop * Math.PI) * 0.5 : 0);
  pod.rotation.z = b > 0.6 ? Math.sin(clock * 0.55) * 0.05 : 0;
  flame.visible = moving && b > 0.15 && b < 5.6;
  flame.scale.set(1, 0.8 + Math.sin(clock * 40) * 0.2, 1);

  /* words */
  const settled = !moving ? tw.to : -1;
  beatEls.forEach((el) => el.classList.toggle('on', +el.dataset.beat === settled));
  ring.classList.toggle('on', settled === 1);

  /* beat 6: the card swap (timed by the same eased clock as every other beat) */
  sw = clamp(b - 5);
  const a = easeInOut(seg(sw, 0, 0.28)), bb = easeInOut(seg(sw, 0.22, 0.68)), c = easeInOut(seg(sw, 0.62, 1));
  const S = 0.84, RAD = 44;
  view.style.transform = `translate3d(${-112 * bb}vw, 0, 0) scale(${1 - (1 - S) * a})`;
  view.style.borderRadius = `${RAD * a}px`;
  // then, after a screen of cockpit, fly out through the centre window into the footer's night
  const out = easeInOut(seg(scrollScreens, LAST_BEAT + 1.4, LAST_BEAT + 2.9));
  cockpitEl.style.transform = `translate3d(${112 * (1 - bb)}vw, 0, 0) scale(${(S + (1 - S) * c) * (1 + out * 1.9)})`;
  cockpitEl.style.borderRadius = `${RAD * (1 - c)}px`;
  cockpitEl.style.opacity = sw > 0.18 ? 1 : 0;
  cockpitEl.classList.toggle('is-live', sw >= 1 && out < 0.3);
  outVeil.style.opacity = smooth(seg(out, 0.15, 0.75));      // the window's world gives way to night, then the footer
  if (sw === 0) cockpit.jump(1);                          // park on Work, the window you arrive at
  cockpit.hold(sw < 1 || out > 0);
  stage.paused = sw > 0.7;
  cockpitStages.forEach((s) => { s.paused = sw < 0.12 || out > 0.98; });
}

/* life: rocks tumble */
world.tick.push((dt) => {
  scene.children.forEach((o) => { if (o.userData.spin) { o.rotation.x += o.userData.spin * dt; o.rotation.y += o.userData.spin * dt * 0.7; } });
});

/* ------------------------------------------------ the portal: your cursor looks into the shipped version
   The hero is a BLUEPRINT; the portal shows it SHIPPED (full colour). Click drops a portal that
   stays open. Launching blows the portal open over everything. */
const canvas = $('#gl');
const mask = document.createElement('canvas'), mctx = mask.getContext('2d');
const maskTex = new THREE.CanvasTexture(mask); maskTex.minFilter = THREE.LinearFilter; maskTex.generateMipmaps = false;
const portals = [];
const cur = { x: 0.62, y: 0.55, tx: 0.62, ty: 0.55, r: 0, on: false };
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
  const W = mask.width, H = mask.height;
  mctx.filter = 'none'; mctx.fillStyle = '#000'; mctx.fillRect(0, 0, W, H);
  mctx.filter = 'blur(2px)'; mctx.fillStyle = '#fff';
  const R = Math.min(W, H) * 0.2;
  portals.forEach((pt, i) => blob(pt.x * W, pt.y * H, pt.r * R, t, i + 1));
  if (cur.r > 0.01) blob(cur.x * W, cur.y * H, cur.r * R + open * Math.hypot(W, H), t, 0);
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
function updatePortal(dt, h0) {
  portalClock += dt;
  const k = 1 - Math.exp(-dt * 9);
  cur.x += (cur.tx - cur.x) * k; cur.y += (cur.ty - cur.y) * k;
  cur.r += ((cur.on && h0 < 0.02 ? 1 : 0) - cur.r) * (1 - Math.exp(-dt * 6));
  portals.forEach((pt) => { pt.r += (1 - pt.r) * (1 - Math.exp(-dt * 5)); });
  const open = smooth(seg(h0, 0, 0.55));                     // launching: the portal swallows the screen
  if (open > 0 && cur.r < 0.5) cur.r = Math.max(cur.r, open);
  drawMask(portalClock, open);
  const v = open >= 0.999 ? 'shipped' : 'blueprint';
  stage.setView(v, { lens: 'shipped', mask: open >= 0.999 ? null : maskTex });
  const Rpx = cur.r * Math.min(canvas.clientWidth, canvas.clientHeight) * 0.2 + open * Math.hypot(canvas.clientWidth, canvas.clientHeight);
  launch.style.setProperty('--px', (cur.x * 100).toFixed(2) + '%'); launch.style.setProperty('--py', (cur.y * 100).toFixed(2) + '%');
  launch.style.setProperty('--pr', Rpx.toFixed(1) + 'px');
  if (document.documentElement.dataset.view !== v) document.documentElement.dataset.view = v;
}

/* ------------------------------------------------ blueprint callouts (hero) */
const CALLOUTS = [
  { part: 0, dx: -1, dy: -0.25, n: '01', t: 'Canopy · designer', b: 'Sees it before it exists' },
  { part: 1, dx: 1, dy: 0.25, n: '02', t: 'Antenna · curious', b: 'Always tuned to the next idea' },
  { part: 2, dx: 1, dy: 0.35, n: '03', t: 'Hull · developer', b: 'Builds things that hold up' },
  { part: 3, dx: -1, dy: -0.05, n: '04', t: 'Thruster · ships it', b: 'From idea to launch' },
];
const calloutSvg = $('#callouts'), calloutBox = $('#callout-labels');
const NS = 'http://www.w3.org/2000/svg';
const calloutEls = CALLOUTS.map((c) => {
  const g = document.createElementNS(NS, 'g');
  const line = document.createElementNS(NS, 'polyline'), dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('r', '4'); g.append(line, dot); calloutSvg.appendChild(g);
  const label = document.createElement('div'); label.className = 'callout' + (c.dx < 0 ? ' callout--left' : '');
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

/* the ring and the orbit captions follow the pod on screen */
const pc = V(), pr = V();
stage.onFrame = (s) => {
  if (b < 0.4) drawCallouts(s);
  const w = s.canvas.clientWidth, hh = s.canvas.clientHeight;
  pod.getWorldPosition(pc);
  pr.setFromMatrixColumn(s.camera.matrixWorld, 0).multiplyScalar(podRig.scale.x).add(pc);
  pc.project(s.camera); pr.project(s.camera);
  beatsEl.style.setProperty('--rx', ((pc.x * 0.5 + 0.5) * w).toFixed(1) + 'px');
  beatsEl.style.setProperty('--ry', ((-pc.y * 0.5 + 0.5) * hh).toFixed(1) + 'px');
  beatsEl.style.setProperty('--rr', Math.abs((pr.x - pc.x) * 0.5 * w).toFixed(1) + 'px');
};

requestAnimationFrame(frame);

/* footer: a quiet stretch of the asteroid field; the cards are pinned to rocks with lime beacons */
{
  const fStage = new Stage($('#footer-gl'), { dpr: 1.5 });
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
  const cards = [...document.querySelectorAll('#footer-cards .fcard')], fv = V();
  fStage.onFrame = (s) => {
    const w = s.canvas.clientWidth, hh = s.canvas.clientHeight;
    cards.forEach((el, i) => {
      fv.copy(fBeacons[i].light.position).project(s.camera);
      el.style.transform = 'translate(' + ((fv.x * 0.5 + 0.5) * w) + 'px, ' + ((-fv.y * 0.5 + 0.5) * hh) + 'px) translate(-50%, -100%)';
    });
  };
}

/* footer: back to the top */
document.querySelectorAll('[data-top]').forEach((bt) => bt.addEventListener('click', () => scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })));
reveal();
