import * as THREE from 'three';
import Lenis from 'lenis';
import { mountGrain } from '../ds/grain.js';
import { setLight, setGrade } from '../ds/toon/materials.js';
import { pageTransitions } from '../ds/transitions.js';
import { about, projects, site } from '../content.js';
import { FXStage } from '../contact/fx.js';
import { buildGlow, TREE, RIVER, riverX } from './glow.js';

/* =====================================================================
   ABOUT · THE GLOW
   A night walk through a glowing forest. Each section is its own set and
   its own camera move:
     hero        a colossal flower opens and turns to follow you
     about       dive through its heart into a cutaway of glowing roots;
                 the sentence lights as the pulse runs along the threads
     work        burst up beside a giant tree, ride its trunk to the canopy;
                 the projects hang there as pods (drag to spin, hover to open)
     experience  a fast ride down the river of light, roles rushing past
   ===================================================================== */
mountGrain();
pageTransitions();

const $ = (s, r = document) => r.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, sstep = THREE.MathUtils.smoothstep;
const esc = (x) => String(x).replace(/[<>&]/g, '');
const list = projects.filter((p) => p.featured !== false);

/* ------------------------------------------------ sections */
const words = (txt) => txt.split(' ').map((w, i) => `<span class="w" style="--i:${i}">${esc(w)}</span>`).join(' ');
const SENTENCE = `${about.lede} I care about measuring things honestly, building tools that work without me, and keeping them cheap to run.`;
$('#glow').innerHTML = `
  <section class="sec sec--hero" data-sec="hero" data-label="Hello">
    <p class="hero__k"><span class="pill">About · ${site.role}</span></p>
    <h1 class="hero__t"><span class="hero__line">Hi, I’m</span><span class="hero__name">Shubh.</span></h1>
    <p class="hero__lede">${esc(site.bio)}</p>
    <p class="hero__hint"><i></i>Scroll to dive in</p>
  </section>
  <section class="sec sec--about" data-sec="about" data-label="About me">
    <div class="about__inner">
      <p class="sec__k">01 · Underneath it all</p>
      <p class="about__line" id="about-line">${words(SENTENCE)}</p>
      <dl class="stones">${[...about.facts2, { k: 'On GitHub', v: '@333shubh', href: site.github }].map((f, i) => `<div class="stone" style="--d:${i}"><dt>${esc(f.k)}</dt><dd>${f.href ? `<a href="${f.href}" target="_blank" rel="noopener">${esc(f.v)} ↗</a>` : esc(f.v)}</dd></div>`).join('')}</dl>
    </div>
  </section>
  <section class="sec sec--work" data-sec="work" data-label="Selected work">
    <div class="work__head">
      <p class="sec__k">02 · Up in the canopy</p>
      <h2 class="sec__t">Selected work</h2>
      <p class="sec__hint">${list.length} projects hang up here. Drag to spin the canopy, hover a pod to open it.</p>
    </div>
  </section>
  <section class="sec sec--exp" data-sec="experience" data-label="Experience"></section>
  <section class="sec sec--next" data-sec="education" data-label="Education"><div class="soon"><p class="sec__k">04 · The old tree</p><h2 class="sec__t">Education</h2>${about.education.map((e) => `<p class="soon__row"><b>${esc(e.t)}</b> · ${esc(e.where)} · <span>${esc(e.when)}</span></p>`).join('')}</div></section>
  <section class="sec sec--next" data-sec="skills" data-label="Skills"><div class="soon"><p class="sec__k">05 · Fireflies in jars</p><h2 class="sec__t">Skills &amp; technologies</h2>${about.toolkit.map((g) => `<p class="soon__row"><b>${esc(g.g)}</b> · ${g.items.map(esc).join(', ')}</p>`).join('')}</div></section>
  <section class="sec sec--next" data-sec="achievements" data-label="Achievements"><div class="soon"><p class="sec__k">06 · The crystal cave</p><h2 class="sec__t">Achievements</h2>${about.numbers.map((n) => `<p class="soon__row"><b>${esc(n.n)}</b> ${esc(n.t)}</p>`).join('')}</div></section>
  <section class="sec sec--next" data-sec="exploring" data-label="Exploring"><div class="soon"><p class="sec__k">07 · Look up</p><h2 class="sec__t">Currently exploring</h2>${about.exploring.map((e) => `<p class="soon__row"><b>${esc(e.t)}</b> · ${esc(e.d)}</p>`).join('')}</div></section>
  <section class="sec sec--next" data-sec="interests" data-label="Interests"><div class="soon"><p class="sec__k">08 · Round the fire</p><h2 class="sec__t">Personal interests</h2>${about.interests.map((e) => `<p class="soon__row"><b>${esc(e.t)}</b> · ${esc(e.d)}</p>`).join('')}</div></section>
  <section class="sec sec--next" data-sec="cta" data-label="Say hello"><div class="soon"><p class="sec__k">09 · Release a lantern</p><h2 class="sec__t">Let’s make something.</h2><a class="btn" href="/contact.html"><span class="btn__label">Send a signal</span><span class="btn__chip" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></a></div></section>
  <section class="sec sec--next sec--foot" data-sec="footer" data-label="The stars"><div class="soon"><p class="sec__k">Above the canopy</p><h2 class="sec__t">Shubh Jadiya</h2><p class="soon__row"><a class="link" href="/#cockpit">Back to the cockpit</a> · <a class="link" href="/work.html">Work</a> · <a class="link" href="/contact.html">Contact</a> · <a class="link" href="${site.github}" target="_blank" rel="noopener">GitHub ↗</a></p></div></section>`;
const secs = [...document.querySelectorAll('.sec')];
const sec = Object.fromEntries(secs.map((el) => [el.dataset.sec, el]));
// the trail: one dot per section on the left edge
$('#trail').innerHTML = secs.map((el, i) => `<button type="button" data-i="${i}" aria-label="${el.dataset.label}"><i></i><span>${el.dataset.label}</span></button>`).join('');

/* ------------------------------------------------ renderer + world */
const stage = new FXStage($('#gl'), { dpr: 1.5, fade: [45, 200] });
stage.bloomLevels = 2;
const cam = stage.camera;
cam.fov = 46; cam.near = 0.1; cam.far = 900; cam.updateProjectionMatrix();
stage.post.material.uniforms.uFar.value = 900;
const W = buildGlow(list);
stage.setWorld({ scene: W.scene, attach() {}, update: (dt, t) => frame(dt, t) });
const fx = stage.fx;
fx.uVig.value = 0.7; fx.uCA.value = 0.2;
stage.post.material.uniforms.uAlpha.value = 0.45;          // softer ink lines here: lush, not cartoony

/* ------------------------------------------------ scroll + the camera path (keys come from where each section sits) */
const lenis = reduced ? null : new Lenis({ lerp: 0.075, wheelMultiplier: 0.85 });
const rafLoop = (now) => { lenis?.raf(now); requestAnimationFrame(rafLoop); };
requestAnimationFrame(rafLoop);
scrollTo(0, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let KEYS = [], posCurve, lookCurve;
function buildPath() {
  const vh = innerHeight, at = (el, f = 0.5) => (el.offsetTop + el.offsetHeight * f - vh / 2) / vh;
  const start = (el) => el.offsetTop / vh;
  const k = [];
  k.push([0, V(0, 100, 92), V(-30, 112, -260)]);                                              // hero: daylight over a sea of canopy and mist
  k.push([at(sec.hero, 0.42), V(4, 64, 26), V(8, 18, -16)]);                                    // dropping through the hole in the canopy
  k.push([at(sec.hero, 0.8), V(-2, 8, 30), V(5, 11, -6)]);                                       // landing by the bloom
  k.push([at(sec.hero, 1) + 0.12, V(9, 15, 0), V(9, -20, -6)]);                                  // over its heart, looking in                           // hover over its heart, looking in
  k.push([at(sec.about, 0.25), V(0, -34, 26), V(0, -36, -10)]);                               // dropped into the roots
  k.push([at(sec.about, 0.75), V(4, -37, 23), V(4, -36, -10)]);
  k.push([at(sec.work, 0) + 0.15, V(TREE.x - 20, -2, TREE.z + 30), V(TREE.x, 14, TREE.z)]);   // burst up beside the trunk
  k.push([at(sec.work, 0.25), V(TREE.x - 22, 14, TREE.z + 26), V(TREE.x, 34, TREE.z)]);       // the elevator up the trunk
  k.push([at(sec.work, 0.6), V(TREE.x - 30, 44, TREE.z + 26), V(TREE.x, 41, TREE.z)]);        // the canopy and its pods
  k.push([at(sec.work, 0.95), V(TREE.x - 28, 46, TREE.z + 24), V(TREE.x, 42, TREE.z)]);
  const e0 = start(sec.experience), e1 = e0 + sec.experience.offsetHeight / vh - 1;
  for (let i = 0; i <= 6; i++) { const f = i / 6, z = lerp(RIVER.z0 - 6, RIVER.z1 + 14, f); k.push([lerp(e0, e1, f), V(riverX(z), 3 + Math.sin(i) * 0.4, z), V(riverX(z - 26), 2.4, z - 26)]); }
  const stops = { education: [V(-40, 7, -338), V(-46, 5, -372)], skills: [V(-14, 7, -390), V(-8, 5, -420)], achievements: [V(14, 8, -428), V(22, 6, -460)],
    exploring: [V(4, 4, -470), V(-6, 70, -540)], interests: [V(-18, 7, -500), V(-24, 4, -530)], cta: [V(0, 5, -520), V(0, 18, -560)], footer: [V(0, 90, -540), V(0, 70, -660)] };
  for (const [name, [p, l]] of Object.entries(stops)) k.push([at(sec[name], 0.5), p, l]);
  KEYS = k;
  posCurve = new THREE.CatmullRomCurve3(k.map((x) => x[1]), false, 'centripetal');
  lookCurve = new THREE.CatmullRomCurve3(k.map((x) => x[2]), false, 'centripetal');
}
function pathAt(s, P, L) {
  s = clamp(s, KEYS[0][0], KEYS[KEYS.length - 1][0]);
  let i = 0; while (i < KEYS.length - 2 && s > KEYS[i + 1][0]) i++;
  const f = clamp((s - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0] || 1), 0, 1);
  const e = f * f * (3 - 2 * f) * 0.35 + f * 0.65;                                              // a little ease into each set
  const u = (i + e) / (KEYS.length - 1);
  posCurve.getPoint(u, P); lookCurve.getPoint(u, L);
}
const progressOf = (el) => clamp((scrollY - el.offsetTop + innerHeight * 0.5) / el.offsetHeight, 0, 1);
addEventListener('resize', () => { buildPath(); });
addEventListener('load', buildPath);
buildPath();
$('#trail').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const el = secs[+b.dataset.i]; const y = el.offsetTop + (el.dataset.sec === 'hero' ? 0 : el.offsetHeight / 2 - innerHeight / 2); lenis ? lenis.scrollTo(y, { duration: 2.4 }) : scrollTo(0, y); });

/* ------------------------------------------------ pointer */
addEventListener('pointermove', (e) => stage.pointer.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)));

/* ------------------------------------------------ the pods: labels pinned in the canopy, a card blooms on hover */
const podLayer = $('#pods');
podLayer.innerHTML = list.map((p, i) => `<button type="button" class="pod" data-i="${i}" style="--c:${W.giant.pods[i].color}"><i></i><span>${esc(p.name)}</span></button>`).join('')
  + `<article class="card podcard" id="podcard" hidden><div class="card__media"><img id="pc-img" alt="" /></div><p class="podcard__k" id="pc-k"></p><h3 class="card__title" id="pc-t"></h3><p class="card__body" id="pc-b"></p><p class="podcard__tags" id="pc-tags"></p><div class="card__action podcard__go" id="pc-go"></div></article>`;
const podBtns = [...podLayer.querySelectorAll('.pod')], podCard = $('#podcard');
let podHover = -1, podPinned = -1, ringAngle = 0, ringVel = 0.05, dragging = false, dragX = 0;
const showPod = (i) => {
  podHover = i;
  if (i < 0) { if (podPinned < 0) podCard.hidden = true; return; }
  const p = list[i];
  $('#pc-img').src = `/work/${p.slug}.jpg`; $('#pc-img').alt = `${p.name} landing page`;
  $('#pc-k').textContent = `${String(i + 1).padStart(2, '0')} · ${p.year}`;
  $('#pc-t').textContent = p.name; $('#pc-b').textContent = p.line;
  $('#pc-tags').innerHTML = p.tags.map((t) => `<span>${esc(t)}</span>`).join('');
  $('#pc-go').innerHTML = (p.live ? `<a class="btn btn--sm" href="${p.live}" target="_blank" rel="noopener"><span class="btn__label">Visit ↗</span></a>` : '') + (p.repo ? `<a class="link" href="${p.repo}" target="_blank" rel="noopener">Code ↗</a>` : '');
  podCard.style.setProperty('--c', W.giant.pods[i].color);
  podCard.hidden = false; podCard.classList.remove('bloom'); void podCard.offsetWidth; podCard.classList.add('bloom');
};
podBtns.forEach((b) => {
  b.addEventListener('pointerenter', () => showPod(+b.dataset.i)); b.addEventListener('focus', () => showPod(+b.dataset.i));
  b.addEventListener('click', () => { podPinned = podPinned === +b.dataset.i ? -1 : +b.dataset.i; showPod(podPinned); });
});
podLayer.addEventListener('pointerleave', () => { if (podPinned < 0) showPod(-1); else showPod(podPinned); });
// drag anywhere in the work section to spin the canopy
const inWork = () => { const p = progressOf(sec.work); return p > 0.3 && p < 0.98; };
addEventListener('pointerdown', (e) => { if (!inWork() || e.target.closest('a, button, .podcard')) return; dragging = true; dragX = e.clientX; });
addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - dragX; dragX = e.clientX; ringVel = dx * 0.004; ringAngle += dx * 0.004; });
addEventListener('pointerup', () => { dragging = false; });

/* ------------------------------------------------ the river ride: roles rush past as huge type */
const runway = $('#runway');
runway.innerHTML = `<p class="sec__k run__k">03 · Down the river</p>` + about.experience.map((x, i) => `<div class="run" data-i="${i}"><p class="run__when">${esc(x.when)}</p><h3 class="run__role">${esc(x.role)}</h3><p class="run__org">${esc(x.org)}</p><p class="run__d">${esc(x.d)}</p></div>`).join('');
const runs = [...runway.querySelectorAll('.run')];

/* ------------------------------------------------ the frame */
const P = new THREE.Vector3(), L = new THREE.Vector3(), v3 = new THREE.Vector3(), trunkW = new THREE.Vector3();
const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
const fogCol = new THREE.Color(), C_DAY = new THREE.Color('#a8d8c4'), C_DUSK = new THREE.Color('#d8946a'), C_NIGHT = new THREE.Color('#1c0e0c'), C_ROOTS = new THREE.Color('#0c0704'), tmpC = new THREE.Color();
const G_DAY = [1.9, 2.0, 1.8], G_DUSK = [1.8, 1.4, 1.25], G_NIGHT = [0.95, 0.9, 1.0];
const mixG = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const lineWords = [...document.querySelectorAll('#about-line .w')];
const trailBtns = [...document.querySelectorAll('#trail button')];
let introT = 0, lastActive = -1;
function frame(dt, t) {
  const s = scrollY / innerHeight;
  pathAt(s, P, L);
  if (!reduced) { P.x += stage.pointerSmooth.x * 1.2; P.y += stage.pointerSmooth.y * 0.6; }
  introT += dt;
  cam.position.copy(P); cam.lookAt(L);
  const y = cam.position.y, under = y < -6;
  // time of day: daylight through the hero and the roots, dusk at the tree, night (fire and ash) on the river and after
  const night = clamp(sstep(progressOf(sec.work), 0.1, 0.95) * 0.45 + sstep(progressOf(sec.experience), 0.0, 0.45) * 0.55, 0, 1);
  const g = mixG(mixG(G_DAY, G_DUSK, sstep(night, 0.1, 0.45)), G_NIGHT, sstep(night, 0.45, 0.9)); setGrade(...g);
  fogCol.copy(C_DAY).lerp(C_DUSK, sstep(night, 0.1, 0.45)).lerp(C_NIGHT, sstep(night, 0.45, 0.9)).lerp(C_ROOTS, sstep(-y, 4, 20));
  W.scene.fog.color.copy(fogCol);
  const high = sstep(y, 30, 80);
  W.scene.fog.near = under ? 10 : lerp(lerp(25, 60, high), 15, night); W.scene.fog.far = under ? 120 : lerp(lerp(260, 560, high), 200, night);
  W.sky.position.copy(cam.position); W.sky.material.uniforms.uNight.value = night; W.sky.material.uniforms.uTime.value = t;
  W.starGroup.position.copy(cam.position);
  W.stars.material.uniforms.uTime.value = t; W.stars.material.uniforms.uColor.value.setScalar(sstep(night, 0.5, 1) * 1.1);
  setLight(night < 0.5 ? [-0.4, 0.8, 0.5] : [0.25, 0.7, -0.5]);
  const px = stage.h / 900;
  W.points.forEach((p) => { p.material.uniforms.uTime.value = t; p.material.uniforms.uPx.value = px; });
  W.moss.material.uniforms.uBoost.value = 0.12 + night * 0.9; W.pollen.material.uniforms.uBoost.value = 1 - night * 0.75;
  W.bark.uniforms.uNight.value = night; W.grass.material.uniforms.uNight.value = night; W.river.material.uniforms.uNight.value = night;
  W.pools.forEach((o) => { o.material.opacity = 0.14 * night; });
  W.volcanic.tick(t, night);
  W.mist.forEach((m, i) => { m.material.uniforms.uTime.value = t + i * 40; m.material.uniforms.uAmp.value = (1 - night * 0.75) * (0.35 + high * 0.65); });
  W.rays.forEach((r, i) => { r.material.opacity = (0.07 + Math.sin(t * 0.6 + i) * 0.03) * (1 - night) * (1 - high * 0.8); });
  W.gliders.forEach((o) => {
    const a = o.ph + t * o.sp, pos = v3.set(o.c.x + Math.cos(a) * o.R, o.y + Math.sin(t * 0.5 + o.ph) * 4, o.c.z + Math.sin(a) * o.R);
    o.g.lookAt(o.c.x + Math.cos(a + 0.05) * o.R, pos.y, o.c.z + Math.sin(a + 0.05) * o.R); o.g.position.copy(pos);
    o.g.userData.wings.forEach((wg) => { wg.pivot.rotation.z = wg.side * Math.sin(t * 2.6 + o.ph) * 0.45; wg.glow.material.opacity = night * 0.9; });
  });
  fx.uBloom.value = lerp(0.35, 1.3, sstep(night, 0.2, 0.8)); fx.uCursor.value.set(stage.pointerSmooth.x * 0.5 + 0.5, stage.pointerSmooth.y * 0.5 + 0.5);

  // hero: the bloom opens on arrival and turns toward you
  W.bloom.tick(t, reduced ? 1 : clamp((introT - 0.3) / 2.6, 0, 1.4), stage.pointerSmooth);
  // the lantern: mushrooms near your cursor flare
  const aspect = innerWidth / innerHeight;
  for (const m of W.shrooms) {
    m.getWorldPosition(v3); v3.y += 3; v3.project(cam);
    const d = v3.z < 1 ? Math.hypot((v3.x - stage.pointerSmooth.x) * aspect, v3.y - stage.pointerSmooth.y) : 9;
    const k = (0.75 + Math.sin(t * 1.2 + m.userData.ph) * 0.25) * (0.2 + night * 0.8) + sstep(0.35 - d, 0, 0.35) * 1.4;
    m.userData.halo.material.opacity = 0.45 * k; m.userData.gills.material.opacity = 0.25 + 0.4 * k;
  }
  W.stops.tick(t, sstep(progressOf(sec.education), 0.2, 0.8));
  // the grass bends away from your cursor; islands drift; waterfalls pour
  ray.setFromCamera(stage.pointerSmooth, cam);
  if (ray.ray.intersectPlane(groundPlane, hit)) W.grass.material.uniforms.uCursor.value.copy(hit);
  W.grass.material.uniforms.uTime.value = t;
  W.bark.uniforms.uTime.value = t;
  W.islands.forEach((o) => { o.isl.position.y = o.y + Math.sin(t * 0.25 + o.ph) * 2; o.isl.userData.fall.material.uniforms.uTime.value = t; });

  // about: the light front runs along the roots, the sentence lights behind it
  const pa = progressOf(sec.about);
  W.roots.mat.uniforms.uTime.value = t; W.roots.mat.uniforms.uReveal.value = lerp(-80, 80, sstep(pa, 0.15, 0.8));
  const lit = Math.floor(sstep(pa, 0.18, 0.75) * lineWords.length);
  lineWords.forEach((w, i) => w.classList.toggle('on', i < lit));

  // work: pods spin, labels follow them, the hovered one swells
  const pw = progressOf(sec.work), showPods = pw > 0.42 && pw < 0.99;
  if (!dragging) { ringVel += (0.05 - ringVel) * (1 - Math.exp(-dt * 0.8)); ringAngle += ringVel * dt * (podHover >= 0 || podPinned >= 0 ? 0.1 : 1); }
  W.giant.ring.rotation.y = ringAngle;
  W.giant.group.getWorldPosition(trunkW);
  const camDir = v3.copy(cam.position).sub(trunkW).setY(0).normalize().clone();
  W.giant.pods.forEach((p, i) => {
    const on = i === podHover || i === podPinned;
    p.hover += ((on ? 1 : 0) - p.hover) * (1 - Math.exp(-dt * 8));
    p.pod.scale.set(1 + p.hover * 0.5, 1.5 + p.hover * 0.7, 1 + p.hover * 0.5);
    p.pod.material.uniforms.uTime.value = t; p.pod.material.uniforms.uGlow.value = 1 + p.hover * 1.4;
    p.core.scale.setScalar(4.5 + p.hover * 6 + Math.sin(t * 2 + i) * 0.4);
    p.seed.rotation.set(t * 0.6, t * 0.9 + i, 0);
    p.holder.rotation.z = Math.sin(t * 0.8 + i) * 0.05;
    const wp = p.pod.getWorldPosition(new THREE.Vector3());
    const front = new THREE.Vector3(wp.x - trunkW.x, 0, wp.z - trunkW.z).normalize().dot(camDir) > -0.25;
    const sp = wp.clone().project(cam);
    const b = podBtns[i];
    const vis = showPods && front && sp.z < 1;
    b.classList.toggle('is-on', vis);
    b.style.transform = `translate(${((sp.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-sp.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px)`;
    if (on && !podCard.hidden) {
      const x = (sp.x * 0.5 + 0.5) * innerWidth, yy = (-sp.y * 0.5 + 0.5) * innerHeight;
      const left = x > innerWidth * 0.55 ? x - 340 : x + 40;
      podCard.style.transform = `translate(${clamp(left, 20, innerWidth - 330).toFixed(0)}px, ${clamp(yy - 200, 80, innerHeight - 470).toFixed(0)}px)`;
    }
  });
  if (!showPods && !podCard.hidden) { podCard.hidden = true; podHover = podPinned = -1; }

  // experience: the river runs faster, the roles rush past
  const pe = progressOf(sec.experience);
  W.river.material.uniforms.uTime.value = t; W.river.material.uniforms.uSpeed.value = 1 + sstep(pe, 0.02, 0.2) * (1 - sstep(pe, 0.85, 1)) * 3;
  runway.classList.toggle('is-on', pe > 0.03 && pe < 0.97);
  const N = runs.length;
  runs.forEach((el, i) => {
    const c = (i + 0.5) / N, local = (pe - c) * N;                                               // −0.5..0.5 while it's yours
    const k = clamp(local + 0.5, 0, 1), near = 1 - Math.abs(local) * 2;
    el.style.opacity = Math.abs(local) < 0.75 ? clamp(1.4 - Math.abs(local) * 2.2, 0, 1).toFixed(3) : '0';
    el.style.transform = `translate(-50%, -50%) scale(${(0.55 + k * 0.9).toFixed(3)}) translateY(${((0.5 - k) * 60).toFixed(1)}px)`;
    el.style.filter = `blur(${Math.max(0, (Math.abs(local) - 0.18) * 14).toFixed(1)}px)`;
    void near;
  });
  fx.uCA.value = 0.25 + (runway.classList.contains('is-on') ? 0.5 : 0);

  // the trail marks where you are
  let active = 0; secs.forEach((el, i) => { if (scrollY + innerHeight * 0.5 >= el.offsetTop) active = i; });
  if (active !== lastActive) { lastActive = active; trailBtns.forEach((b, i) => b.classList.toggle('is-on', i === active)); }
}

/* arrival */
requestAnimationFrame(() => setTimeout(() => $('#veil').classList.add('is-gone'), 100));
if (import.meta.env.DEV) { window.__W = W; window.__stage = stage; window.__lenis = lenis; }
