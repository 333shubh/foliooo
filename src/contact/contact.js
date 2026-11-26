import * as THREE from 'three';
import Lenis from 'lenis';
import { mountGrain } from '../ds/grain.js';
import { setLight } from '../ds/toon/materials.js';
import { pageTransitions } from '../ds/transitions.js';
import { contact } from '../content.js';
import { FXStage } from './fx.js';
import { buildSignal, sampleText, STATION, SAT_Y, TITLE_Y, waveAt } from './signal.js';
import { rng } from '../ds/toon/props.js';

/* =====================================================================
   CONTACT · SIGNAL
   You arrive at the bottom of the sea. Scrolling rises: past glowing
   coral, jellyfish and a whale, through the surface, up to a relay
   station in a storm. Write a message and transmit: the dish fires a
   beam through the clouds and the camera rides it to orbit, where a
   satellite catches it and leaves a new star in the sky.
   ===================================================================== */
mountGrain();
pageTransitions();

const $ = (s, r = document) => r.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 900px)').matches || matchMedia('(pointer: coarse)').matches;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, sstep = THREE.MathUtils.smoothstep;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeIn = (k) => k * k * k;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

/* ------------------------------------------------ renderer + world */
const stage = new FXStage($('#gl'), { dpr: 1.5, fade: [45, 190] });
stage.bloomLevels = 2;
const cam = stage.camera;
cam.fov = 45; cam.near = 0.1; cam.far = 900; cam.updateProjectionMatrix();
stage.post.material.uniforms.uFar.value = 900;

const S = buildSignal();
stage.setWorld({ scene: S.scene, attach() {}, update: (dt, t) => frame(dt, t) });
const fx = stage.fx;
const glowSets = [S.tips, S.amb, S.bub, S.title, S.msgStars, S.spray.points, S.trail.points];
const msgStarDirs = [];

/* ------------------------------------------------ the camera path */
const SMAX = 5.3;   // scroll length in screens (see contact.html: 100 + 3×100 + 130 + 100 vh)
const KEYS = [
  [0.0, [0, -118, 27], [0, -118, 0]],
  [0.95, [-6, -100, 29], [-4, -96, -2]],
  [1.95, [-3, -76, 30], [-6, -72, -6]],
  [2.95, [-8, -48, 31], [-3, -44, -8]],
  [3.75, [-5, -18, 31], [-2, -10, -10]],
  [4.25, [-7, -1.5, 30], [-1, 3, -10]],
  [4.6, [-9, 3.8, 33], [1, 10, -9]],
  [5.3, [-17, 7, 37], [-8, 15, -8]],
];
const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[1])), false, 'centripetal');
const lookCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[2])), false, 'centripetal');
function pathAt(s, P, L) {
  s = clamp(s, 0, SMAX);
  let i = 0; while (i < KEYS.length - 2 && s > KEYS[i + 1][0]) i++;
  const f = clamp((s - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0]), 0, 1);
  const u = (i + f) / (KEYS.length - 1);
  posCurve.getPoint(u, P); lookCurve.getPoint(u, L);
}

/* ------------------------------------------------ scroll */
history.scrollRestoration = 'manual'; scrollTo(0, 0);
const lenis = reduced ? null : new Lenis({ lerp: 0.075, wheelMultiplier: 0.8 });
const rafLoop = (now) => { lenis?.raf(now); requestAnimationFrame(rafLoop); };
requestAnimationFrame(rafLoop);
const scrollS = () => {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  return (scrollY / max) * SMAX;
};
let forcedS = null;

/* ------------------------------------------------ pointer */
const ndc = new THREE.Vector2();
addEventListener('pointermove', (e) => { ndc.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)); stage.pointer.copy(ndc); });
const ray = new THREE.Raycaster(), titlePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), cursorW = new THREE.Vector3(1e3, 1e3, 0);

/* ------------------------------------------------ the plankton title */
const TS = S.titleState;
let titleReady = false, titleT = 0;
document.fonts.load('600 220px "Inter Tight"').catch(() => {}).finally(() => {
  const visW = 2 * 27 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (innerWidth / innerHeight);
  let pts = sampleText('Say hello.', { width: Math.min(27, visW * 0.84), step: small ? 5 : 4 });
  if (pts.length > 6000) pts = pts.filter((_, i) => i % Math.ceil(pts.length / 6000) === 0);
  const n = pts.length, g = S.title.geometry, P = g.attributes.position.array, C = g.attributes.aColor.array, Z = g.attributes.aSize.array;
  TS.n = n; TS.home = new Float32Array(n * 3); TS.vel = new Float32Array(n * 3);
  const lime = new THREE.Color('#9dffa4'), cyan = new THREE.Color('#8af4ff'), pink = new THREE.Color('#ff9be4'), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    TS.home.set([x, TITLE_Y + 1 + y, (Math.random() - 0.5) * 0.6], i * 3);
    const a = Math.random() * Math.PI * 2, rr = 14 + Math.random() * 30;
    P.set([Math.cos(a) * rr, TITLE_Y - 20 - Math.random() * 25, -10 + Math.sin(a) * rr * 0.5], i * 3);   // they rise up out of the dark
    const u = (x / 27) + 0.5;
    c.copy(cyan).lerp(lime, clamp(u * 1.3, 0, 1)); if (Math.random() < 0.12) c.copy(pink);
    c.multiplyScalar(0.8 + Math.random() * 0.45);
    C.set([c.r, c.g, c.b], i * 3);
    Z[i] = 0.16 + Math.random() * 0.2;
  }
  g.setDrawRange(0, n);
  g.attributes.position.needsUpdate = g.attributes.aColor.needsUpdate = g.attributes.aSize.needsUpdate = true;
  titleReady = true;
});
function tickTitle(dt, t) {
  if (!titleReady || (cam.position.y > -70 && titleT > 6)) return;
  titleT += dt;
  const P = S.title.geometry.attributes.position.array, H = TS.home, V = TS.vel;
  const k = (reduced ? 1 : sstep(titleT, 0.3, 3.2)) * 9, damp = Math.exp(-dt * 3.2), R = 4.2;
  for (let i = 0, j = 0; i < TS.n; i++, j += 3) {
    let vx = V[j], vy = V[j + 1], vz = V[j + 2];
    vx += (H[j] - P[j]) * k * dt + Math.sin(t * 1.3 + i) * 0.3 * dt;
    vy += (H[j + 1] - P[j + 1]) * k * dt + Math.cos(t * 1.1 + i * 0.7) * 0.3 * dt + (k < 1 ? 3 * dt : 0);
    vz += (H[j + 2] - P[j + 2]) * k * dt;
    const dx = P[j] - cursorW.x, dy = P[j + 1] - cursorW.y, d2 = dx * dx + dy * dy;
    if (d2 < R * R) { const d = Math.sqrt(d2) + 0.001, f = (1 - d / R) * 70 * dt; vx += (dx / d) * f; vy += (dy / d) * f; vz += f * 0.6; }
    vx *= damp; vy *= damp; vz *= damp;
    P[j] += vx * dt; P[j + 1] += vy * dt; P[j + 2] += vz * dt;
    V[j] = vx; V[j + 1] = vy; V[j + 2] = vz;
  }
  S.title.geometry.attributes.position.needsUpdate = true;
}

/* ------------------------------------------------ message stars (kept between visits) */
const starStore = () => { try { return JSON.parse(localStorage.getItem('signal-stars') || '[]'); } catch { return []; } };
function placeStars() {
  const list = starStore().slice(-64), g = S.msgStars.geometry, P = g.attributes.position.array, C = g.attributes.aColor.array, Z = g.attributes.aSize.array;
  list.forEach((d, i) => { P.set([d[0] * 500, d[1] * 500, d[2] * 500], i * 3); C.set([0.55, 1, 0.6], i * 3); Z[i] = i === list.length - 1 && justSent ? 18 : 7; });
  g.setDrawRange(0, list.length);
  g.attributes.position.needsUpdate = g.attributes.aColor.needsUpdate = g.attributes.aSize.needsUpdate = true;
}
let justSent = false;
placeStars();

/* ------------------------------------------------ buoys: one per way to reach me */
const email = contact.email, gh = contact.links.find((l) => l.label === 'GitHub'), li = contact.links.find((l) => l.label === 'LinkedIn');
const MORSE = { email: '.... ..', linkedin: '.. -.', github: '--. ....' };
const morseSeq = (code) => { const out = []; for (const ch of code) { if (ch === ' ') out.push([0, 0.36]); else out.push([1, ch === '.' ? 0.12 : 0.36], [0, 0.12]); } out.push([0, 0.8]); return out; };
const tagHTML = {
  email: `<button type="button" title="${email}"><i></i>Email <small data-say>copy address</small></button>`,
  linkedin: `<a href="${li?.href}" target="_blank" rel="noopener"><i></i>LinkedIn <small>${li?.handle} ↗</small></a>`,
  github: `<a href="${gh?.href}" target="_blank" rel="noopener"><i></i>GitHub <small>${gh?.handle} ↗</small></a>`,
};
const tagLayer = $('#tags');
// a glowing line runs from each label down to its buoy's lamp
const SVGNS = 'http://www.w3.org/2000/svg';
const tagLines = document.createElementNS(SVGNS, 'svg'); tagLines.setAttribute('class', 'tag-lines'); tagLines.setAttribute('aria-hidden', 'true'); tagLayer.appendChild(tagLines);
S.buoys.forEach((b) => {
  const el = document.createElement('div');
  el.className = 'buoy-tag'; el.style.setProperty('--c', b.color);
  el.innerHTML = tagHTML[b.id];
  tagLayer.appendChild(el); b.el = el;
  b.line = document.createElementNS(SVGNS, 'path'); b.line.setAttribute('class', 'tag-line'); b.line.style.setProperty('--c', b.color);
  b.lineGlow = document.createElementNS(SVGNS, 'path'); b.lineGlow.setAttribute('class', 'tag-line tag-line--glow'); b.lineGlow.style.setProperty('--c', b.color);
  b.knot = document.createElementNS(SVGNS, 'circle'); b.knot.setAttribute('class', 'tag-knot'); b.knot.setAttribute('r', '6'); b.knot.style.setProperty('--c', b.color);
  tagLines.append(b.lineGlow, b.line, b.knot);
  const start = () => { b.morse = { seq: morseSeq(MORSE[b.id]), i: 0, t: 0 }; };
  el.addEventListener('pointerenter', start); el.addEventListener('focusin', start);
  el.addEventListener('pointerleave', () => { b.morse = null; }); el.addEventListener('focusout', () => { b.morse = null; });
  if (b.id === 'email') el.querySelector('button').addEventListener('click', async () => {
    const say = el.querySelector('[data-say]');
    try { await navigator.clipboard.writeText(email); say.textContent = 'copied'; el.classList.add('done'); b.spark = 1; }
    catch { location.href = `mailto:${email}`; }
    setTimeout(() => { say.textContent = 'copy address'; el.classList.remove('done'); }, 2000);
  });
});

/* ------------------------------------------------ clocks */
const fmt = (tz) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', ...(tz ? { timeZone: tz } : {}) }).format(new Date());
function tickClocks() {
  const h = +new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date());
  $('#clock-note').innerHTML = `It’s <b>${fmt()}</b> for you and <b>${fmt('Asia/Kolkata')}</b> for me in India. ${h < 7 ? 'I’ll read it in the morning.' : h < 23 ? 'I’m probably awake, and I reply within two days.' : 'I’ll read it first thing tomorrow.'}`;
}
tickClocks(); setInterval(tickClocks, 15000);

/* ------------------------------------------------ skip straight up to the station */
document.querySelectorAll('[data-skip]').forEach((b) => b.addEventListener('click', () => { const y = document.documentElement.scrollHeight - innerHeight; lenis ? lenis.scrollTo(y, { duration: 4.5, easing: ease }) : scrollTo(0, y); }));

/* ------------------------------------------------ the console */
const form = $('#console'), sky = $('#sky'), status = $('#status'), msgEl = form.querySelector('[name="message"]');
let pulse = 0, keyTimes = [], lastStrike = -9;
const AURORA = {
  name: ['#7bf583', '#3ad6b0', '#b25cff'], email: ['#71f0ff', '#5a7dff', '#ff7ad9'],
  kind: ['#ffc58e', '#ff7a8a', '#b25cff'], message: ['#9dffa4', '#ff7ad9', '#7a5cff'],
};
let auroraTarget = AURORA.name.map((c) => new THREE.Color(c));
form.addEventListener('focusin', (e) => { const n = e.target.name; if (AURORA[n]) auroraTarget = AURORA[n].map((c) => new THREE.Color(c)); });
let sigLevel = 0;
// the topic is a word you tap to roll to the next one
const TOPICS = [['an internship', 'An internship'], ['some freelance work', 'Freelance work'], ['a collaboration', 'A collaboration'], ['nothing much, just saying hi', 'Just saying hi']];
let topicI = 0;
const topicBtn = $('#topic'), topicWord = topicBtn.querySelector('.topic__word'), kindInput = $('#kind');
function rollTopic(dir = 1) {
  topicI = (topicI + dir + TOPICS.length) % TOPICS.length;
  const [word, value] = TOPICS[topicI];
  kindInput.value = value; pulse = 1; auroraTarget = AURORA.kind.map((c) => new THREE.Color(c));
  if (reduced) { topicWord.textContent = word; return; }
  topicWord.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-dir * 100}%)`, opacity: 0 }], { duration: 160, easing: 'ease-in' }).onfinish = () => {
    topicWord.textContent = word;
    topicWord.animate([{ transform: `translateY(${dir * 100}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
  };
}
topicBtn.addEventListener('click', () => rollTopic(1));
topicBtn.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); rollTopic(1); } if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); rollTopic(-1); } });
function meter() {
  const d = new FormData(form), msg = `${d.get('message') || ''}`.trim();
  sigLevel = (`${d.get('name') || ''}`.trim() ? 1 : 0) + (/^\S+@\S+\.\S+$/.test(`${d.get('email') || ''}`.trim()) ? 1 : 0) + (msg ? 1 : 0) + (msg.length > 40 ? 1 : 0) + 1;
  sky.classList.toggle('is-ready', sigLevel >= 4);
}
meter();
form.addEventListener('input', () => {
  meter();
  pulse = 1;
  const now = performance.now() / 1000; keyTimes = keyTimes.filter((k) => now - k < 1.4); keyTimes.push(now);
  if (keyTimes.length > 9 && now - lastStrike > 2.6) { strike(); lastStrike = now; }
});

let mail = null, rxFrom = 'you', rxAbout = 'an internship', rxMsg = '';
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (mode !== 'scroll') return;
  const d = new FormData(form);
  const name = `${d.get('name') || ''}`.trim(), from = `${d.get('email') || ''}`.trim(), msg = `${d.get('message') || ''}`.trim();
  form.querySelectorAll('[data-error]').forEach((f) => f.removeAttribute('data-error'));
  const bad = [];
  if (!name) bad.push('name');
  if (!/^\S+@\S+\.\S+$/.test(from)) bad.push('email');
  if (!msg) bad.push('message');
  if (bad.length) {
    bad.forEach((n) => { const el = form.querySelector(`[name="${n}"]`); el.removeAttribute('data-error'); void el.offsetWidth; el.setAttribute('data-error', ''); });
    status.textContent = bad.includes('email') && bad.length === 1 ? 'That email looks incomplete.' : 'Fill in the blanks first.';
    form.querySelector(`[name="${bad[0]}"]`).focus();
    return;
  }
  status.textContent = '';
  const subject = `${d.get('kind')} · from ${name}`;
  rxFrom = name; rxAbout = topicWord.textContent; rxMsg = msg;
  mail = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${msg}\n\n${name}\n${from}`)}`;
  $('#rx-mail').href = `mailto:${email}`;
  startTransmit(/\b(hello|hi|hey)\b/i.test(msg));
});
$('#again').addEventListener('click', () => startReturn());

/* ------------------------------------------------ lightning */
let flash = 0, nextStrike = 3;
function strike() {
  const b = S.bolt, pts = b.makeBolt();
  const x = STATION.x - 90 + Math.random() * 200, z = STATION.z - 60 - Math.random() * 100;
  b.line.geometry.dispose(); b.line.geometry = new THREE.BufferGeometry().setFromPoints(pts); b.line.position.set(x, 0, z);
  b.glow.position.set(x, 36, z); b.t = 0;
  flash = Math.max(flash, 0.7 + Math.random() * 0.3);
  }

/* ------------------------------------------------ spray */
function spray(at, n = 140, power = 1) {
  const sp = S.spray, g = sp.points.geometry, P = g.attributes.position.array, Z = g.attributes.aSize.array, count = Z.length;
  for (let i = 0; i < Math.min(n, count); i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.random() * 1.6;
    P.set([at.x + Math.cos(a) * rr, at.y, at.z + Math.sin(a) * rr], i * 3);
    sp.vel.set([Math.cos(a) * (2 + Math.random() * 6) * power, (5 + Math.random() * 12) * power, Math.sin(a) * (2 + Math.random() * 6) * power], i * 3);
    Z[i] = 0.12 + Math.random() * 0.3;
  }
  g.setDrawRange(0, Math.min(n, count)); sp.life = 2.2; sp.points.visible = true; sp.base = Z.slice();
}
function tickSpray(dt) {
  const sp = S.spray; if (sp.life <= 0) return;
  sp.life -= dt;
  const g = sp.points.geometry, P = g.attributes.position.array, Z = g.attributes.aSize.array, n = g.drawRange.count;
  for (let i = 0; i < n; i++) {
    sp.vel[i * 3 + 1] -= 22 * dt;
    P[i * 3] += sp.vel[i * 3] * dt; P[i * 3 + 1] += sp.vel[i * 3 + 1] * dt; P[i * 3 + 2] += sp.vel[i * 3 + 2] * dt;
    Z[i] = sp.base[i] * clamp(sp.life / 1.2, 0, 1);
  }
  g.attributes.position.needsUpdate = g.attributes.aSize.needsUpdate = true;
  if (sp.life <= 0) sp.points.visible = false;
}

/* ------------------------------------------------ the transmission */
let mode = 'scroll', tx = 0, hello = false, fired = false, caught = false, starBorn = false, rxShown = false;
const P0 = new THREE.Vector3(), L0 = new THREE.Vector3(), HP = new THREE.Vector3(STATION.x - 19, 3.4, STATION.z + 31), HL = new THREE.Vector3(STATION.x - 1, 16, STATION.z);
const camP = new THREE.Vector3(), camL = new THREE.Vector3(), tmp = new THREE.Vector3(), focusW = new THREE.Vector3();
let rxShot = null, shakeAmp = 0, caKick = 0, starFrom = new THREE.Vector3(), starDir = new THREE.Vector3();
const dish = S.station.dish;

function startTransmit(isHello) {
  hello = isHello; fired = caught = starBorn = rxShown = false; tx = 0;
  P0.copy(camP); L0.copy(camL);
  dish.focus.getWorldPosition(focusW);
  dissolve();
  sky.classList.add('is-sending');
  document.body.classList.add('is-tx');
  lenis?.stop();
  if (reduced) { finishInstant(); return; }
  mode = 'tx';
}
// every letter of the sentence breaks loose and streams down into the dish
function dissolve() {
  if (reduced) return;
  dish.focus.getWorldPosition(focusW); focusW.project(cam);
  const tx0 = (focusW.x * 0.5 + 0.5) * innerWidth, ty0 = (-focusW.y * 0.5 + 0.5) * innerHeight;
  const layer = document.createElement('div'); layer.className = 'sparks'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer);
  const textOf = (el) => [...el.childNodes].map((n) => n.nodeType === 3 ? n.textContent : n.matches?.('input') ? n.value : n.matches?.('.topic') ? topicWord.textContent : '').join('');
  const sources = [...form.querySelectorAll('.sky__line')].map((el) => [el, textOf(el)]);
  const msg = msgEl.value.trim(); sources.push([msgEl, msg.length > 160 ? msg.slice(0, 157) + '…' : msg]);
  let n = 0;
  sources.forEach(([el, text], li) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const line = document.createElement('p'); line.className = 'sparks__line';
    Object.assign(line.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width + 40}px`, font: cs.font, letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight, color: li < 3 ? '#fff' : '#eee', textShadow: cs.textShadow });
    line.innerHTML = [...text].map((ch) => `<span>${ch === ' ' ? '\u00a0' : ch.replace(/[<&>]/g, '')}</span>`).join('');
    layer.appendChild(line);
    [...line.children].forEach((sp) => {
      const b = sp.getBoundingClientRect(), dx = tx0 - (b.left + b.width / 2), dy = ty0 - (b.top + b.height / 2);
      const lift = -30 - Math.random() * 50, jx = (Math.random() - 0.5) * 60;
      sp.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1, color: '#ffffff', textShadow: '0 0 0 transparent' },
        { offset: 0.3, transform: `translate(${jx}px, ${lift}px) scale(1.15) rotate(${(Math.random() - 0.5) * 50}deg)`, opacity: 1, color: '#d6ffc4', textShadow: '0 0 14px #7bf583' },
        { transform: `translate(${dx}px, ${dy}px) scale(0.15) rotate(${(Math.random() - 0.5) * 300}deg)`, opacity: 0, color: '#7bf583', textShadow: '0 0 20px #7bf583' },
      ], { duration: 1100 + Math.random() * 300, delay: n * 5 + li * 70, easing: 'cubic-bezier(0.55, 0, 0.75, 0.2)', fill: 'forwards' });
      n++;
    });
  });
  setTimeout(() => layer.remove(), 1800 + n * 5 + 400);
}
function finishInstant() {
  addStar(new THREE.Vector3(Math.sin(-0.2) * Math.cos(0.3), Math.sin(0.3), -Math.cos(-0.2) * Math.cos(0.3)));
  if (mail) location.href = mail;
  showRx(); mode = 'orbit-static';
}
function addStar(dir) {
  const list = starStore(); list.push([+dir.x.toFixed(4), +dir.y.toFixed(4), +dir.z.toFixed(4)]);
  localStorage.setItem('signal-stars', JSON.stringify(list.slice(-64)));
  justSent = true; placeStars();
}
function showRx() {
  const n = starStore().length;
  const first = rxFrom && rxFrom !== 'you' ? rxFrom.split(/\s+/)[0] : '';
  const no = `No. ${String(n).padStart(3, '0')}`;
  $('#rx-k').textContent = `Transmission ${String(n).padStart(3, '0')}`;
  $('#rx-from').textContent = first || 'You';
  $('#rx-about').textContent = rxAbout.replace(/^(an?|some) /, '');
  $('#rx-time').textContent = fmt();
  $('#rx-star').textContent = no;
  if (rxShot) $('#rx-shot').src = rxShot;
  // a little barcode drawn from your message
  const seed = [...(rxMsg || 'hello')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rr = rng(seed);
  $('#rx-code').innerHTML = Array.from({ length: 56 }, (_, i) => `<i class="${rr() < 0.12 ? 'lime' : ''}" style="height:${(25 + rr() * 75).toFixed(0)}%;animation-delay:${(0.5 + i * 0.012).toFixed(3)}s"></i>`).join('');
  $('#star-name').textContent = first ? `${first}’s star` : 'Your star';
  $('#star-date').textContent = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()) + ` · ${no}`;
  $('#rx').hidden = false; rxShown = true;
  setTimeout(() => $('#again').focus({ preventScroll: true }), 600);
}
let ret = 0;
function startReturn() {
  if (mode === 'orbit-static') { resetConsole(); mode = 'scroll'; return; }
  if (mode !== 'orbit') return;
  mode = 'return'; ret = 0; P0.copy(camP); L0.copy(camL);
  $('#rx').hidden = true;
}
function resetConsole() {
  $('#rx').hidden = true;
  form.reset(); topicI = -1; rollTopic(1); meter(); sky.classList.remove('is-sending');
  document.body.classList.remove('is-tx');
  lenis?.start();
}

const FIRE = 1.6, RIDE0 = 2.3, RIDE1 = 7.6;
function txFrame(dt, P, L) {
  tx += dt;
  const t = tx;
  // 1 · charge: the camera drops low and wide, the dish swings to the zenith
  const a = ease(seg(t, 0, FIRE));
  P.lerpVectors(P0, HP, a); L.lerpVectors(L0, HL, a);
  dish.pitch.rotation.x = lerp(dishPitch0, 0, ease(seg(t, 0.1, 1.4)));
  dish.yaw.rotation.y = lerp(dishYaw0, 0, ease(seg(t, 0.1, 1.4)));
  const ch = easeIn(seg(t, 0.35, FIRE));
  dish.charge.scale.setScalar(0.001 + ch * (5 + Math.sin(t * 60) * 0.8));
  dish.core.scale.setScalar(0.001 + ch * 0.9);
  if (t < FIRE) { shakeAmp = Math.max(shakeAmp, 0.04 + ch * 0.16); pulse = Math.max(pulse, ch); }
  // 2 · fire
  if (!fired && t >= FIRE) {
    fired = true;
    dish.focus.getWorldPosition(focusW);
    S.beam.group.position.copy(focusW); S.beam.group.visible = true;
    S.shock.visible = true; flash = 0.6; caKick = 2.2; shakeAmp = 0.9;
    setTimeout(strike, 120); setTimeout(strike, 420);
    S.clouds.forEach((c) => { c.target = 0; });
  }
  if (fired) {
    const f = t - FIRE;
    const len = 460 * easeOut(clamp(f / 0.55, 0, 1));
    const fade = 1 - seg(t, RIDE1 + 0.4, RIDE1 + 1.6);
    const amps = [1.3, 0.75, 0.32];
    S.beam.layers.forEach((m, i) => { m.scale.y = Math.max(0.001, len); m.material.uniforms.uAmp.value = amps[i] * fade * (0.85 + Math.sin(t * 40 + i) * 0.15); m.material.uniforms.uTime.value = t; });
    S.beam.flare.scale.setScalar((14 + 30 * Math.exp(-f * 3)) * fade + 0.001);
    dish.charge.scale.setScalar((3 + Math.sin(t * 50) * 0.5) * fade + 0.001);
    const rr = 6 + 260 * easeOut(clamp(f / 2.4, 0, 1));
    S.shock.scale.setScalar(rr); S.shock.material.uniforms.uAmp.value = 1.3 * (1 - clamp(f / 2.4, 0, 1));
    S.sea.material.uniforms.uRing.value = f < 3.5 ? 3 + f * 26 : -1;
    S.clouds.forEach((c) => { const d = Math.hypot(c.home.x - STATION.x, c.home.z - STATION.z); if (rr > d) c.target = 30 + (c.home.y % 7) * 6; });
  }
  // the whale answers a hello
  if (hello) {
    const u = seg(t, 1.9, 4.9), b = S.breacher;
    b.visible = u > 0 && u < 1;
    if (b.visible) {
      b.position.set(STATION.x - 30 + u * 16, -9 + 25 * Math.sin(Math.PI * u), STATION.z - 16 + u * 4);
      b.rotation.set(0, -0.5, lerp(1.15, -1.25, u));
      b.userData.tail.rotation.z = Math.sin(t * 5) * 0.3;
      if (!b.userData.out && u > 0.2) { b.userData.out = true; spray(tmp.set(b.position.x, 0, b.position.z), 160, 1.3); }
      if (!b.userData.in && u > 0.82) { b.userData.in = true; spray(tmp.set(b.position.x + 6, 0, b.position.z), 220, 1.6); }
    } else if (u >= 1) b.userData.out = b.userData.in = false;
  }
  // 3 · ride the beam to orbit
  if (t > RIDE0) {
    const k = ease(seg(t, RIDE0, RIDE1));
    const y = lerp(3.4, SAT_Y - 34, k);
    P.set(lerp(HP.x, STATION.x + 15, k), y, lerp(HP.z, STATION.z + 19, k));
    const lookUp = lerp(14, 34, k);
    L.set(STATION.x, y + lookUp, STATION.z);
    shakeAmp = Math.max(shakeAmp, 0.14 * (1 - k));
  }
  // 4 · caught: the satellite flares, the beam lets go, a star is born
  if (t > RIDE1) {
    const k = ease(seg(t, RIDE1 + 0.6, RIDE1 + 2.4));
    tmp.set(STATION.x - 30, SAT_Y + 30, STATION.z - 220);
    L.lerpVectors(L.set(STATION.x, SAT_Y, STATION.z), tmp, k);
    if (!caught) {
      caught = true; flash = Math.max(flash, 0.35);
      const amps = S.beam.layers.map((m) => m.material.uniforms.uAmp.value);
      S.beam.layers.forEach((m) => { m.material.uniforms.uAmp.value *= 0.3; }); const fs = S.beam.flare.scale.x; S.beam.flare.scale.setScalar(0.001);
      S.sat.getWorldPosition(tmp); rxShot = shot(tmp.clone().add(new THREE.Vector3(15, -9, 12)), tmp.clone().add(new THREE.Vector3(0, 1.5, 0)));
      S.beam.layers.forEach((m, i) => { m.material.uniforms.uAmp.value = amps[i]; }); S.beam.flare.scale.setScalar(fs);
    }
    const sf = t - RIDE1;
    S.sat.userData.flare.scale.setScalar(0.001 + 22 * Math.exp(-sf * 1.6) * seg(sf, 0, 0.15));
    if (!starBorn && sf > 0.8) {
      starBorn = true;
      S.sat.getWorldPosition(starFrom);
      const az = -0.45 + Math.random() * 0.6, el = 0.22 + Math.random() * 0.14;
      starDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    }
    if (starBorn) {
      const u = ease(seg(sf, 0.8, 2.4));
      tmp.copy(cam.position).addScaledVector(starDir, 500);
      S.newStar.position.lerpVectors(starFrom, tmp, u);
      S.newStar.scale.setScalar(u >= 1 ? 0.001 : 6 + 30 * u + Math.sin(t * 20) * 2);
      if (u >= 1 && mode === 'tx') {
        addStar(starDir);
        if (mail) location.href = mail;
        setTimeout(showRx, 250);
        mode = 'orbit';
      }
    }
  }
}
let dishYaw0 = 0, dishPitch0 = 0;

function returnFrame(dt, P, L) {
  ret += dt;
  const k = ease(seg(ret, 0, 2.8));
  pathAt(SMAX, camP, camL);
  P.lerpVectors(P0, camP, k); L.lerpVectors(L0, camL, k);
  // re-enter the storm with a little wobble through the cloud deck
  if (ret > 2.8) { mode = 'scroll'; resetConsole(); S.beam.group.visible = false; S.shock.visible = false; justSent = false; placeStars(); }
}

/* ------------------------------------------------ the frame */
let frameN = 0, prevY = TITLE_Y, introT = reduced ? 9 : 0, gaugeKey = '', underK = 1;
const P = new THREE.Vector3(), L = new THREE.Vector3(), fogCol = new THREE.Color();
const WATER = [[0, '#3fb4d6'], [12, '#2f80c8'], [40, '#3a2a9e'], [75, '#26106a'], [110, '#120534']].map(([d, c]) => [d, new THREE.Color(c)]);
const waterAt = (depth, out) => { for (let i = 0; i < WATER.length - 1; i++) { const [d0, c0] = WATER[i], [d1, c1] = WATER[i + 1]; if (depth <= d1 || i === WATER.length - 2) return out.copy(c0).lerp(c1, clamp((depth - d0) / (d1 - d0), 0, 1)); } return out; };
const C_STORM = new THREE.Color('#4a2272'), C_SPACE = new THREE.Color('#0c0820');
const cloudBase = S.cloudMat.uniforms.uBase.value.clone(), cloudLight = S.cloudMat.uniforms.uLight.value.clone(), cloudFlash = new THREE.Color('#a8e6ff');
const v3 = new THREE.Vector3();
const gaugeV = $('#gauge-v'), gaugeU = $('#gauge-u'), gaugeK = $('#gauge-k'), gaugeZ = $('#gauge-zone'), gaugeM = $('#gauge-mark');

function frame(dt, t) {
  if (++frameN === 4) shootThumbs();
  // where is the camera?
  if (mode === 'scroll') {
    pathAt(forcedS ?? scrollS(), P, L);
    if (!(reduced)) { P.x += stage.pointerSmooth.x * 1.4; P.y += stage.pointerSmooth.y * 0.7; }
    dishYaw0 = dish.yaw.rotation.y; dishPitch0 = dish.pitch.rotation.x;
  } else if (mode === 'tx') txFrame(dt, P, L);
  else if (mode === 'return') returnFrame(dt, P, L);
  else if (mode === 'orbit') { P.copy(camP).lerp(P, 0); P.x += Math.sin(t * 0.2) * 0.02; L.set(STATION.x - 30, SAT_Y + 30, STATION.z - 220); }
  camP.copy(P); camL.copy(L);
  if (introT < 2.6) { introT += dt; const k = easeOut(clamp(introT / 2.6, 0, 1)); P.y += (1 - k) * 18; L.y += (1 - k) * 8; shakeAmp = Math.max(shakeAmp, (1 - k) * 0.25); }
  // shake
  shakeAmp *= Math.exp(-dt * 3);
  if (shakeAmp > 0.002) P.add(v3.set((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5) * 0.5).multiplyScalar(shakeAmp));
  cam.position.copy(P); cam.lookAt(L);

  const y = cam.position.y, under = y < 0;
  if (prevY < 0 && y >= 0) { fx.uDrops.value = 1; flash = Math.max(flash, 0.3); spray(v3.set(cam.position.x, 0, cam.position.z - 4), 200, 0.9); }
  if (prevY >= 0 && y < 0) { spray(v3.set(cam.position.x, 0, cam.position.z - 4), 100, 0.6); }
  prevY = y;

  // atmosphere
  const depthK = clamp(-y / 120, 0, 1), alt = sstep(y, 60, 300);
  underK += ((under ? 1 : 0) - underK) * (1 - Math.exp(-dt * 12));
  if (under) { waterAt(-y, fogCol); S.scene.fog.near = 1; S.scene.fog.far = lerp(130, 62, depthK); }
  else { fogCol.copy(C_STORM).lerp(C_SPACE, alt); S.scene.fog.near = 30; S.scene.fog.far = lerp(280, 5000, alt); }
  S.scene.fog.color.copy(fogCol);
  const su = S.sky.material.uniforms;
  su.uUnder.value = under ? 1 : 0; su.uFog.value.copy(fogCol); su.uAlt.value = alt; su.uFlash.value = flash; su.uTime.value = t;
  S.starGroup.position.copy(cam.position);
  S.stars.material.uniforms.uColor.value.setScalar(under ? 0 : lerp(0.22, 1.25, alt));
  S.stars.material.uniforms.uTime.value = t;
  setLight(under ? [0.2, 1, 0.35] : [-0.55, 0.62, 0.6]);
  S.deep.visible = y < 14; S.storm.visible = y > -30;
  S.auroras.forEach((a) => { a.visible = y > -1; });

  // finishing pass
  flash *= Math.exp(-dt * 4.5); caKick *= Math.exp(-dt * 2.2);
  fx.uFlash.value = flash * 0.2; fx.uCA.value = 0.22 + caKick + (under ? 0.15 : 0);
  fx.uWater.value = underK; fx.uDrops.value *= under ? 0 : Math.exp(-dt * 0.55);
  fx.uTorch.value = under ? sstep(-y, 25, 95) * 0.8 : 0;
  fx.uBloom.value = under ? 1.15 : lerp(0.95, 1.3, alt);
  fx.uCursor.value.set(stage.pointerSmooth.x * 0.5 + 0.5, stage.pointerSmooth.y * 0.5 + 0.5);
  const px = stage.h / 900;
  glowSets.forEach((p) => { p.material.uniforms.uTime.value = t; p.material.uniforms.uPx.value = px; });

  tickPins();
  tickSky();
  tickStarTag();
  if (S.deep.visible) tickDeep(dt, t);
  if (S.storm.visible) tickStorm(dt, t);
  tickSpace(dt, t);
  tickSpray(dt);
  tickGauge(y);
}

/* ------------------------------------------------ card thumbnails: framed shots of this very world
   Rendered once in the first frames (while the plunge still covers the screen) and handed to the cards. */
function shot(P, L) {
  cam.position.copy(P); cam.lookAt(L); cam.updateMatrixWorld();
  const y = P.y, under = y < 0;
  const alt = sstep(y, 60, 300);
  if (under) { waterAt(-y, fogCol); S.scene.fog.near = 1; S.scene.fog.far = lerp(150, 80, clamp(-y / 120, 0, 1)); }
  else { fogCol.copy(C_STORM).lerp(C_SPACE, alt); S.scene.fog.near = 30; S.scene.fog.far = lerp(280, 5000, alt); }
  S.scene.fog.color.copy(fogCol);
  const su = S.sky.material.uniforms; su.uUnder.value = under ? 1 : 0; su.uFog.value.copy(fogCol); su.uAlt.value = alt; su.uFlash.value = 0;
  S.starGroup.position.copy(P); S.stars.material.uniforms.uColor.value.setScalar(under ? 0 : lerp(0.22, 1.25, alt));
  S.sat.visible = y > 150;
  setLight(under ? [0.2, 1, 0.35] : [-0.55, 0.62, 0.6]);
  S.deep.visible = y < 14; S.storm.visible = y > -30; S.auroras.forEach((a) => { a.visible = y > -1; }); S.title.visible = false;
  S.schools.forEach((sc) => { sc.mesh.visible = under; });
  fx.uFlash.value = 0; fx.uCA.value = 0.18; fx.uWater.value = 0; fx.uDrops.value = 0; fx.uTorch.value = 0; fx.uBloom.value = under ? 1.25 : 1.1;
  stage.render();
  return stage.canvas.toDataURL('image/jpeg', 0.88);
}
function shootThumbs() {
  const shots = [];
  // 01 · the relay station at sunset, from low on the water
  dish.pitch.rotation.x = 0.85; dish.yaw.rotation.y = -0.5;
  shots.push(shot(new THREE.Vector3(STATION.x - 24, 3.2, STATION.z + 24), new THREE.Vector3(STATION.x + 2, 11, STATION.z - 4)));
  // 02 · the shallows: light rays through aqua water, kelp, a school going by
  S.rays.forEach((r) => { r.material.uniforms.uAmp.value = 1.2; });
  S.schools.forEach((sc, i) => { for (let k = 0; k < 40; k++) sc.tick(1 / 30, k / 30, v3.set(-8 + i * 6, -16 + i * 2, 4)); });
  shots.push(shot(new THREE.Vector3(-14, -22, 20), new THREE.Vector3(0, -9, -12)));
  // 03 · a jellyfish, close
  const j = S.jellies[4]; j.tick(2, 1.6);
  shots.push(shot(j.group.position.clone().add(new THREE.Vector3(3.5, 1.2, 9)), j.group.position.clone().add(new THREE.Vector3(-0.5, -1.4, 0))));
  S.title.visible = true;
  pins.forEach((el, i) => {
    const media = el.querySelector('.card__media'), img = new Image();
    img.alt = ''; img.className = 'card__shot'; img.src = shots[i];
    img.onload = () => media.classList.add('has-shot');
    media.appendChild(img);
  });
}

/* ------------------------------------------------ the deep, each frame */
function tickDeep(dt, t) {
  ray.setFromCamera(stage.pointerSmooth, cam);
  if (!ray.ray.intersectPlane(titlePlane, cursorW)) cursorW.set(1e3, 1e3, 0);
  tickTitle(dt, t);
  tickTrail(dt);
  S.kelp.material.uniforms.uTime.value = t;
  S.schools.forEach((sc, i) => { sc.mesh.visible = cam.position.y < -4; sc.tick(dt, t, v3.set(Math.sin(t * 0.23 + i * 2.1) * 13 - 2, Math.min(cam.position.y - 1, -14) + Math.sin(t * 0.37 + i) * 5 + (i - 1) * 4, -4 + Math.cos(t * 0.19 + i * 1.7) * 9)); });
  S.clams.forEach((c, i) => { c.userData.hinge.rotation.x = -0.95 + Math.sin(t * 0.6 + i * 2) * 0.1; c.userData.halo.material.opacity = 0.6 + Math.sin(t * 2 + i) * 0.3; });
  // bubbles rise from the vents
  const B = S.bub.geometry.attributes.position.array, sd = S.bubSeeds;
  for (let i = 0; i < sd.length / 3; i++) {
    const ph = sd[i * 3 + 2], yy = -142 + ((ph * 140 + t * (3 + ph * 5)) % 140);
    B[i * 3] = sd[i * 3] + Math.sin(t * 2 + ph * 40) * 0.35 * (1 + (yy + 142) * 0.02); B[i * 3 + 1] = yy; B[i * 3 + 2] = sd[i * 3 + 1] + Math.cos(t * 1.7 + ph * 30) * 0.3;
  }
  S.bub.geometry.attributes.position.needsUpdate = true;
  const rayAmp = sstep(cam.position.y, -95, -20);
  S.rays.forEach((r) => { r.material.uniforms.uTime.value = t; r.material.uniforms.uAmp.value = rayAmp; });
  // jellyfish glow up when your torch comes near
  const aspect = innerWidth / innerHeight;
  for (const j of S.jellies) {
    j.group.position.set(j.home.x + Math.sin(t * 0.21 + j.phase) * 2, j.home.y + Math.sin(t * 0.33 + j.phase) * 2.5, j.home.z);
    v3.copy(j.group.position).project(cam);
    const d = Math.hypot((v3.x - stage.pointerSmooth.x) * aspect, v3.y - stage.pointerSmooth.y);
    j.glow = lerp(j.glow ?? 0.6, 0.55 + 1.7 * sstep(0.7 - d, 0, 0.7), 1 - Math.exp(-dt * 4));
    j.tick(t, j.glow);
  }
  // the whale crosses as you rise past it
  const w = S.whale, k = sstep(cam.position.y, -108, -50);
  w.position.set(lerp(-80, 75, k) + Math.sin(t * 0.1) * 3, Math.min(cam.position.y + 5, -16) + Math.sin(t * 0.4) * 1.2, -26);
  w.rotation.set(0, -0.18, Math.sin(t * 0.8) * 0.05);
  w.userData.tail.rotation.z = Math.sin(t * 1.6) * 0.38;
}

/* ------------------------------------------------ the notes ride on their pearls */
const pins = [...document.querySelectorAll('.pin')], PIN_S = [1, 2, 3];
// each clam is placed where it lands in the lower part of the screen when its note is due
const PIN_X = [-0.36, 0.38, -0.34];
function placeClams() {
  const tc = cam.clone(), P1 = new THREE.Vector3(), L1 = new THREE.Vector3();
  tc.aspect = innerWidth / innerHeight; tc.updateProjectionMatrix();
  PIN_S.forEach((ps, i) => {
    pathAt(ps, P1, L1); tc.position.copy(P1); tc.lookAt(L1); tc.updateMatrixWorld();
    const d = new THREE.Vector3(PIN_X[i] * (innerWidth < 900 ? 0.2 : 1), -0.5, 0.5).unproject(tc).sub(P1).normalize();
    S.clams[i].position.copy(P1).addScaledVector(d, 30); S.clams[i].position.y -= 0.35;
  });
}
placeClams(); addEventListener('resize', () => { placeClams(); pinCardH = 0; });
let pinCardH = 0;
function tickPins() {
  const s = mode === 'scroll' ? (forcedS ?? scrollS()) : -9;
  if (!pinCardH) pinCardH = pins[0].querySelector('.card').offsetHeight || 380;
  pins.forEach((el, i) => {
    const op = 1 - sstep(Math.abs(s - PIN_S[i]), 0.4, 0.8);
    if (op <= 0.001) { if (el.style.opacity !== '0') { el.style.opacity = '0'; el.classList.remove('is-on'); } return; }
    S.clams[i].userData.pearl.getWorldPosition(v3); v3.project(cam);
    const x = (v3.x * 0.5 + 0.5) * innerWidth, yy = (-v3.y * 0.5 + 0.5) * innerHeight;
    const lead = clamp(yy - pinCardH - 96, 18, 200);
    el.style.setProperty('--lead', `${lead}px`);
    el.style.transform = `translate(${x}px, ${yy + 8}px) translate(-50%, -100%)`;
    el.style.opacity = `${op}`;
    el.classList.toggle('is-on', op > 0.5);
  });
}

/* ------------------------------------------------ in orbit, your new star wears a label */
const starTag = $('#star-tag');
function tickStarTag() {
  const on = mode === 'orbit' && !$('#rx').hidden;
  starTag.classList.toggle('is-on', on);
  if (!on) return;
  v3.copy(cam.position).addScaledVector(starDir, 500).project(cam);
  starTag.style.transform = `translate(${((v3.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-v3.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px)`;
}

/* ------------------------------------------------ the sentence appears once you reach the station */
let typing = false;
form.addEventListener('focusin', () => { typing = true; }); form.addEventListener('focusout', () => { typing = false; });
function tickSky() {
  const s = mode === 'scroll' ? (forcedS ?? scrollS()) : -1;
  sky.classList.toggle('is-on', (mode === 'scroll' && s > SMAX - 0.4) || mode === 'tx');
}

/* ------------------------------------------------ your cursor leaves a glowing wake in the deep */
const lastCursor = new THREE.Vector3(), here = new THREE.Vector3();
function tickTrail(dt) {
  const T = S.trail, g = T.points.geometry, P = g.attributes.position.array, Z = g.attributes.aSize.array, n = Z.length;
  ray.ray.at(16, here);
  const moved = here.distanceTo(lastCursor);
  const emit = Math.min(8, Math.floor(moved * 3)) + (Math.random() < dt * 6 ? 1 : 0);
  for (let e = 0; e < emit; e++) {
    const i = T.i; T.i = (T.i + 1) % n;
    const k = Math.random();
    P.set([lastCursor.x + (here.x - lastCursor.x) * k + (Math.random() - 0.5) * 0.4, lastCursor.y + (here.y - lastCursor.y) * k + (Math.random() - 0.5) * 0.4, lastCursor.z + (here.z - lastCursor.z) * k], i * 3);
    T.vel.set([(Math.random() - 0.5) * 1.2, 0.4 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2], i * 3);
    T.life[i] = 1.2 + Math.random() * 1.4; T.base[i] = 0.08 + Math.random() * 0.2;
  }
  lastCursor.copy(here);
  for (let i = 0; i < n; i++) {
    if (T.life[i] <= 0) { Z[i] = 0; continue; }
    T.life[i] -= dt;
    P[i * 3] += T.vel[i * 3] * dt; P[i * 3 + 1] += T.vel[i * 3 + 1] * dt; P[i * 3 + 2] += T.vel[i * 3 + 2] * dt;
    Z[i] = T.base[i] * clamp(T.life[i], 0, 1);
  }
  g.attributes.position.needsUpdate = g.attributes.aSize.needsUpdate = true;
}

/* ------------------------------------------------ the storm, each frame */
const blink = (t, hz, duty = 0.15) => ((t * hz) % 1) < duty ? 1 : 0;
function tickStorm(dt, t) {
  const sea = S.sea.material.uniforms; sea.uTime.value = t; sea.uFlash.value = flash;
  const ru = S.rain.material.uniforms; ru.uTime.value = t; ru.uCam.value.copy(cam.position); ru.uAmp.value = cam.position.y > -1 && cam.position.y < 90 ? 1 : 0;
  // lightning
  nextStrike -= dt;
  if (nextStrike <= 0) { if (cam.position.y > -1 && mode !== 'orbit') strike(); nextStrike = 4 + Math.random() * 6; }
  const b = S.bolt; b.t += dt;
  const on = b.t < 0.4 ? (Math.sin(b.t * 70) > -0.3 ? 1 : 0.2) * (1 - b.t / 0.4) : 0;
  b.line.material.opacity = on; b.glow.material.opacity = on * 0.6;
  S.cloudMat.uniforms.uBase.value.copy(cloudBase).lerp(cloudFlash, flash * 0.35);
  S.cloudMat.uniforms.uLight.value.copy(cloudLight).lerp(cloudFlash, flash * 0.55);
  // the clouds part around the beam, and drift back afterwards
  for (const c of S.clouds) {
    const target = mode === 'tx' || mode === 'orbit' ? c.target ?? 0 : 0;
    c.push += (target - c.push) * (1 - Math.exp(-dt * (target > c.push ? 2.6 : 0.5)));
    const dx = c.home.x - STATION.x, dz = c.home.z - STATION.z, dl = Math.hypot(dx, dz) || 1;
    c.mesh.position.set(c.home.x + (dx / dl) * c.push, c.home.y + Math.sin(t * 0.2 + c.home.x) * 0.6, c.home.z + (dz / dl) * c.push);
  }
  // aurora follows the field you're in
  S.auroras.forEach((a, i) => {
    const u = a.material.uniforms; u.uTime.value = t;
    u.uA.value.lerp(auroraTarget[0], 1 - Math.exp(-dt * 1.5)); u.uB.value.lerp(auroraTarget[1], 1 - Math.exp(-dt * 1.5)); u.uC.value.lerp(auroraTarget[2], 1 - Math.exp(-dt * 1.5));
    u.uAmp.value = (i === 2 ? 0.7 : 1) * (1 + pulse * 0.35 + flash * 0.3);
  });
  // the station
  const st = S.station;
  if (mode === 'scroll') {
    const ty = typing ? -1.05 + pulse * 0.08 : -0.55 + stage.pointerSmooth.x * 0.4, tp = typing ? 0.62 - pulse * 0.06 : 0.75 - stage.pointerSmooth.y * 0.2;
    dish.yaw.rotation.y += (ty - dish.yaw.rotation.y) * (1 - Math.exp(-dt * 2.5));
    dish.pitch.rotation.x += (tp - dish.pitch.rotation.x) * (1 - Math.exp(-dt * 2.5));
    dish.charge.scale.setScalar(0.001); dish.core.scale.setScalar(0.001);
  }
  pulse *= Math.exp(-dt * 5);
  st.tall.userData.lamps[0].material.opacity = 0.25 + 0.75 * blink(t, 0.8, 0.35);
  st.tall.userData.lamps[1].material.opacity = 0.25 + 0.75 * blink(t + 0.4, 0.8, 0.35);
  st.small.userData.lamps[0].material.opacity = 0.3 + 0.7 * blink(t + 0.2, 1.3, 0.25);
  st.deckLamps.forEach((l, i) => { const chase = blink(t * 0.9 + i / 8, 1, 0.3); l.material.opacity = 0.35 + 0.65 * Math.max(chase, pulse); l.scale.setScalar(1.4 + pulse * 1.6); });
  st.windows.forEach((w) => w.material.color.setScalar(1).lerp(new THREE.Color('#ffc58e'), 1 - pulse * 0.6));
  st.winGlow.material.opacity = 0.3 + pulse * 0.6;
  st.statusGlow.material.opacity = 0.55 + Math.sin(t * 3) * 0.3;
  st.floods.forEach((f) => { f.material.uniforms.uAmp.value = 1 + pulse * 1.5 + flash; });
  st.search.rotation.y = t * 0.45;
  st.searchBeam.material.uniforms.uAmp.value = mode === 'tx' ? 0.2 : 0.55 + flash * 0.3;
  // buoys bob on the swell; their lights speak morse while you hover the label
  for (const bu of S.buoys) {
    const g = bu.group, x = g.position.x, z = g.position.z;
    g.position.y = waveAt(x, z, t) * 0.9 - 0.2;
    g.rotation.set((waveAt(x, z + 1, t) - waveAt(x, z - 1, t)) * 0.25, 0, -(waveAt(x + 1, z, t) - waveAt(x - 1, z, t)) * 0.25);
    let lit = 0.55 + Math.sin(t * 2 + x) * 0.25;
    if (bu.morse) {
      const m = bu.morse; m.t += dt;
      while (m.t > m.seq[m.i][1]) { m.t -= m.seq[m.i][1]; m.i = (m.i + 1) % m.seq.length; }
      lit = m.seq[m.i][0] ? 1.6 : 0.08;
    }
    bu.spark = (bu.spark || 0) * Math.exp(-dt * 3);
    g.userData.halo.material.opacity = Math.min(1, lit); g.userData.halo.scale.setScalar(5 * (0.8 + lit * 0.4) + bu.spark * 10);
    g.userData.pool.material.opacity = 0.12 + lit * 0.18;
    g.userData.bulb.material.color.set(bu.color).multiplyScalar(0.6 + Math.min(1, lit) * 0.5);
    g.userData.pillar.material.uniforms.uTime.value = t; g.userData.pillar.material.uniforms.uAmp.value = 0.7 + Math.min(1.2, lit) * 0.5;
    g.userData.rings.forEach((rg, k) => { const u = ((t * 0.45 + k / 3 + x * 0.01) % 1); rg.scale.setScalar(1 + u * 7); rg.material.opacity = (1 - u) * 0.55; });
    bu.el.classList.toggle('lit', !!bu.morse && lit > 1);
    v3.copy(g.userData.top).applyMatrix4(g.matrixWorld).project(cam);
    bu.vis = mode === 'scroll' && cam.position.y > 2.5 && v3.z < 1 && sky.classList.contains('is-on');
    bu.sx = (v3.x * 0.5 + 0.5) * innerWidth; bu.sy = (-v3.y * 0.5 + 0.5) * innerHeight;
    g.userData.bulb.getWorldPosition(v3); v3.project(cam);
    bu.lx = (v3.x * 0.5 + 0.5) * innerWidth; bu.ly = (-v3.y * 0.5 + 0.5) * innerHeight;
    bu.el.classList.toggle('is-on', bu.vis);
  }
  layoutTags();
}

/* the buoy labels never sit on the sentence or on each other: each is nudged right until it's clear */
function layoutTags() {
  S.buoys.forEach((b) => { const o = b.vis ? '1' : '0'; b.line.style.opacity = o; b.lineGlow.style.opacity = o; b.knot.style.opacity = o; });
  const tags = S.buoys.filter((b) => b.vis);
  if (!tags.length) return;
  const tt = performance.now() / 1000;
  const sr = form.getBoundingClientRect(), pad = 18, maxR = innerWidth - 170;
  tags.sort((a, b) => a.sx - b.sx);
  const placed = [];
  for (const b of tags) {
    if (!b.w) { b.w = b.el.offsetWidth; b.h = b.el.offsetHeight; }
    let left = b.sx - b.w / 2; const top = b.sy - b.h + Math.sin(tt * 1.7 + b.sx * 0.01) * 4;   // labels float gently
    if (top < sr.bottom + 8 && top + b.h > sr.top - 8 && left < sr.right + pad) left = sr.right + pad;
    for (const q of placed) if (top < q.bottom + 6 && top + b.h > q.top - 6 && left < q.right + 14 && left + b.w > q.left - 14) left = q.right + 14;   // only labels that share a row push
    left = Math.min(left, maxR - b.w);
    placed.push({ left, right: left + b.w, top, bottom: top + b.h });
    b.el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
    const cx = left + b.w / 2, cy = top + b.h, mx = (cx + b.lx) / 2;
    const d = `M${cx.toFixed(1)} ${cy.toFixed(1)} C${cx.toFixed(1)} ${(cy + (b.ly - cy) * 0.55).toFixed(1)} ${b.lx.toFixed(1)} ${(cy + (b.ly - cy) * 0.45).toFixed(1)} ${b.lx.toFixed(1)} ${(b.ly - 4).toFixed(1)}`;
    b.line.setAttribute('d', d); b.lineGlow.setAttribute('d', d);
    b.knot.setAttribute('cx', b.lx.toFixed(1)); b.knot.setAttribute('cy', b.ly.toFixed(1)); void mx;
  }
}
addEventListener('resize', () => S.buoys.forEach((b) => { b.w = 0; }));

/* ------------------------------------------------ space, each frame */
function tickSpace(dt, t) {
  const y = cam.position.y;
  S.meteors.tick(dt, cam.position, sstep(y, 90, 260));
  S.sat.rotation.y += dt * 0.08; S.sat.rotation.z = Math.sin(t * 0.3) * 0.08;
  S.sat.userData.lamp.material.opacity = 0.3 + 0.7 * blink(t, mode === 'orbit' ? 2.5 : 0.7, 0.3);
  S.sat.visible = y > 150;
}

/* ------------------------------------------------ the gauge */
const railTop = (yy) => (yy >= 0 ? 22 * (1 - clamp(yy / 60, 0, 1)) : 22 + 78 * clamp(-yy / 142, 0, 1));
function tickGauge(y) {
  let k, v, u, zone;
  if (y < 0) { k = 'Depth'; v = Math.round(-y * 6.5); u = 'm'; zone = y < -90 ? 'The deep' : y < -40 ? 'Twilight zone' : 'The shallows'; }
  else if (y < 60) { k = 'Altitude'; v = Math.round(y * 6.5); u = 'm'; zone = y < 3 ? 'Sea level' : y < 30 ? 'Relay station' : 'The storm'; }
  else { k = 'Altitude'; const km = Math.pow(clamp((y - 60) / (SAT_Y - 94), 0, 1), 1.7) * 408; v = km < 1 ? Math.round(390 + km * 1000) : Math.round(km); u = km < 1 ? 'm' : 'km'; zone = y < 130 ? 'Cloud deck' : y < 280 ? 'Upper air' : 'Orbit'; }
  const key = `${k}|${v}|${u}|${zone}`;
  if (key === gaugeKey) return;
  gaugeKey = key;
  gaugeK.textContent = k; gaugeV.textContent = v.toLocaleString('en-GB'); gaugeU.textContent = u; gaugeZ.textContent = zone;
  gaugeM.style.top = `${railTop(y)}%`;
}

/* ------------------------------------------------ arrival: the water closes over you */
requestAnimationFrame(() => setTimeout(() => $('#plunge').classList.add('is-gone'), reduced ? 0 : 150));
if (!reduced) setTimeout(() => { fx.uDrops.value = 0; }, 0);

if (import.meta.env.DEV) {
  window.__s = (s) => { forcedS = s; };                     // dev: freeze the rise at a scroll position (null to release)
  window.__tx = (h = false) => { mail = null; forcedS = SMAX; startTransmit(h); };
  window.__S = S; window.__stage = stage; window.__lenis = lenis;
}
