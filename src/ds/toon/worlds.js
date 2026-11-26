import * as THREE from 'three';
import { worlds as PALETTE } from './palette.js';
import { setLight, toon } from './materials.js';
import { makeProjectPlanet, PLANETS } from './planets.js';
import {
  rng, fbm, noise2, makeSky, makeStars, makeConstellation, makeCloud, makeRock,
  makeShard, makeGem, makePod, makeTree, makeTerrain, makeWater, makePlanet,
  makeRingedPlanet, makeMonolith,
} from './props.js';

/* ==========================================================================
   Worlds. Each returns { scene, update(dt, t, stage), attach(stage), anchors }
   anchors: named 3D points the DOM can pin .tag labels to.
   ========================================================================== */

export function base(name) {
  const pal = PALETTE[name];
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(pal.fog, pal.fogNear, pal.fogFar);
  if (pal.sky) scene.add(makeSky(pal.sky));
  if (pal.stars) scene.add(makeStars(320, { density: pal.stars }));
  return { pal, scene, anchors: {}, tick: [], pre: [] };
}

// Gentle camera drift + pointer parallax, shared by all worlds and sets.
// w.pre runs before the light is set (used to render screens-within-the-scene).
export function rig(w, { pos, look, sway = [1.2, 0.6], fov = 40, drift = 1 }) {
  const P = new THREE.Vector3(...pos), L = new THREE.Vector3(...look);
  w.P = P; w.L = L; w.fov = fov; // sets move these from scroll progress
  w.attach = (stage) => { stage.camera.fov = fov; stage.camera.updateProjectionMatrix(); setLight(w.pal.light); };
  w.update = (dt, t, stage) => {
    for (const f of w.pre) f(dt, t, stage);
    setLight(w.pal.light);
    const c = w.camera || stage.camera, p = stage.pointerSmooth;
    const k = w.swayK ?? 1, dr = drift * (w.drift ?? 1); // sets calm the camera as they zoom in
    c.position.set(P.x + p.x * sway[0] * k + Math.sin(t * 0.13) * 0.3 * dr, P.y + p.y * sway[1] * k + Math.sin(t * 0.17) * 0.15 * dr, P.z);
    c.lookAt(L.x + p.x * sway[0] * 0.25 * k, L.y + p.y * sway[1] * 0.25 * k, L.z);
    for (const f of w.tick) f(dt, t);
  };
  return w;
}

export const bob = (obj, amp = 0.25, speed = 0.8, phase = 0) => { const y = obj.position.y; return (dt, t) => { obj.position.y = y + Math.sin(t * speed + phase) * amp; }; };
export const tumble =(obj, s = 0.3) => { const ax = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); return (dt) => obj.rotateOnAxis(ax, dt * s); };

/* ---------- SPACE: asteroid field, planet edge, pod, constellation ------ */
export function space({ pod = true, constellation = true } = {}) {
  const w = base('space'), { scene } = w, r = rng(11);

  const planet = makePlanet({ radius: 34 });
  planet.position.set(-26, -40, -14); scene.add(planet); w.edge = planet;
  w.tick.push((dt) => { planet.rotation.y += dt * 0.01; });

  // asteroids in a loose shell, keeping the middle clear for type
  for (let i = 0; i < 34; i++) {
    const a = r() * Math.PI * 2, rad = 9 + r() * 22;
    const x = Math.cos(a) * rad * 1.3, y = Math.sin(a) * rad * 0.75, z = -r() * 40 + 4;
    if (Math.abs(x) < 8 && Math.abs(y) < 4 && z > -12) continue;
    const s = 0.3 + Math.pow(r(), 2.5) * 3.2;
    const rock = makeRock({ seed: i + 3, tone: r() > 0.35 ? 'rock' : 'violet', squash: [1, 0.7 + r() * 0.4, 1] });
    rock.scale.setScalar(s); rock.position.set(x, y, z); rock.rotation.set(r() * 6, r() * 6, r() * 6);
    scene.add(rock); w.tick.push(tumble(rock, 0.05 + r() * 0.15), bob(rock, 0.15, 0.3 + r() * 0.4, r() * 6));
  }
  // data shards + gems
  for (let i = 0; i < 16; i++) {
    const shard = makeShard({ tone: i % 5 === 0 ? 'lime' : 'crystal', len: 0.6 + r() * 1.1, w: 0.18 + r() * 0.12 });
    shard.position.set((r() - 0.5) * 34, (r() - 0.5) * 18, -r() * 18 + 2);
    shard.rotation.set(r() * 6, r() * 6, r() * 6);
    scene.add(shard); w.tick.push(tumble(shard, 0.4 + r() * 0.5), bob(shard, 0.3, 0.5 + r(), r() * 6));
  }
  const gem = makeGem({ size: 1.7 }); gem.position.set(-12.5, -7.2, 2); scene.add(gem);
  w.tick.push(tumble(gem, 0.18)); w.anchors.gem = gem;

  if (pod) {
    const p = makePod(); p.scale.setScalar(2.8); p.position.set(6.5, 4.6, -6); p.rotation.y = -0.35;
    scene.add(p); w.tick.push(bob(p, 0.35, 0.7), (dt, t) => { p.rotation.z = Math.sin(t * 0.5) * 0.05; });
    w.pod = p; w.anchors.pod = p;
  }
  if (constellation) {
    const R = 200, at = (az, el) => new THREE.Vector3(Math.sin(az) * Math.cos(el) * R, Math.sin(el) * R, -Math.cos(az) * Math.cos(el) * R);
    const nodes = [
      { name: 'Project · Atlas', pos: at(-0.42, 0.2) }, { name: 'Project · Tide', pos: at(-0.3, 0.12) },
      { name: 'Project · Ember', pos: at(-0.18, 0.19) }, { name: 'Project · Moss', pos: at(-0.1, 0.07) },
      { name: 'Project · Comet', pos: at(-0.24, 0.02), bright: 1 },
    ];
    const con = makeConstellation(nodes, [[0, 1], [1, 2], [2, 3], [1, 4]]);
    scene.add(con); w.constellation = con;
  }
  return rig(w, { pos: [0, 0, 26], look: [0, 0, 0], sway: [1.6, 1.0] });
}

/* ---------- WATER: lagoon, teal cliffs, pink clouds, hovering pod ------- */
export function water({ night = false, pod = true } = {}) {
  const w = base(night ? 'dusk' : 'water'), { scene } = w;
  const land = night ? 'violet' : 'teal';
  const wat = makeWater({ tone: night ? 'teal' : 'water' }); scene.add(wat);
  w.tick.push((dt, t) => { wat.material.uniforms.uTime.value = t; });

  const height = (x, z) => {
    const back = THREE.MathUtils.smoothstep(-z, 18, 70);                    // mountains rise behind
    const sides = THREE.MathUtils.smoothstep(Math.abs(x), 10, 48);          // valley stays open in the middle
    const isl = Math.max(0, fbm(x * 0.05 + 3, z * 0.05, 4) - 0.52) * 18;     // scattered islands
    const m = fbm(x * 0.025, z * 0.025, 5);
    return -1.2 + isl + back * (6 + m * 26) * (0.35 + sides * 0.9) + sides * m * 8 * (1 - back * 0.5);
  };
  scene.add(makeTerrain({ size: 260, seg: 180, height, tone: land, cz: -40 }));

  if (!night) for (const [x, y, z, s, seed] of [[-10, 15, -40, 3.2, 1], [14, 19, -70, 4, 2], [32, 12, -60, 2.6, 3], [-34, 20, -90, 4.5, 4]]) {
    const c = makeCloud({ seed, puffs: 7 }); c.position.set(x, y, z); c.scale.setScalar(s); scene.add(c);
    w.tick.push((dt) => { c.position.x += dt * 0.25; if (c.position.x > 80) c.position.x = -80; });
  }
  if (night) {
    const R = 200, at = (az, el) => new THREE.Vector3(Math.sin(az) * Math.cos(el) * R, Math.sin(el) * R, -Math.cos(az) * Math.cos(el) * R);
    scene.add(makeStars(140, { density: 1, minY: 0.12, seed: 3 }));
    const nodes = [at(-0.32, 0.34), at(-0.17, 0.26), at(-0.05, 0.36), at(0.08, 0.16), at(0.24, 0.3)].map((pos) => ({ pos }));
    scene.add(makeConstellation(nodes, [[0, 1], [1, 2], [1, 3], [3, 4]]));
  }
  const gem = makeGem({ size: 1.2 }); gem.position.set(15, 1.8, -6); scene.add(gem); w.tick.push(tumble(gem, 0.2), bob(gem, 0.25, 1.1));
  w.anchors.gem = gem;
  if (pod) {
    const p = makePod(); p.scale.setScalar(3); p.position.set(0, 7.5, -12); scene.add(p);
    w.tick.push(bob(p, 0.4, 0.6)); w.pod = p; w.anchors.pod = p;
  }
  return rig(w, { pos: [0, 6, 22], look: [0, 6, -10], sway: [2, 0.8] });
}

/* ---------- EARTH: rolling hills, round trees, rust mesas, white clouds - */
export function earth({ pod = false, desert = false } = {}) {
  const w = base('earth'), { scene } = w, r = rng(5);
  // rust mesas behind (terraced)
  const mesa = (x, z) => {
    const back = THREE.MathUtils.smoothstep(-z, 30, 60);
    const m = fbm(x * 0.03 + 9, z * 0.03, 4);
    return back * Math.max(0, m - 0.35) * 70;
  };
  scene.add(makeTerrain({ size: 320, depth: 200, seg: 200, height: mesa, tone: 'mesa', terrace: 4.5, cz: -135 }));
  // grassy rolling hills in front
  const hills = (x, z) => fbm(x * 0.035, z * 0.035 + 4, 4) * 9 - 3 + Math.max(0, -z - 30) * 0.05;
  scene.add(makeTerrain({ size: 160, depth: 90, seg: 140, height: desert ? (x, z) => hills(x, z) * 0.5 - 1 : hills, tone: desert ? 'sand' : 'grass', cz: -15 }));
  for (let i = 0; i < 22; i++) {
    const x = (r() - 0.5) * 90, z = -r() * 50 - 4;
    if (Math.abs(x) < 6 && z > -20) continue;
    if (desert) { // boulders instead of trees
      if (i % 2) continue;
      const b = makeRock({ tone: 'mesa', seed: i + 50, squash: [1.4, 0.55, 1] }); b.scale.setScalar(0.8 + r() * 1.6);
      b.position.set(x, (hills(x, z) * 0.5 - 1) + 0.2, z); scene.add(b); continue;
    }
    const t = makeTree({ seed: i + 1, scale: 0.9 + r() * 0.8 }); t.position.set(x, hills(x, z) - 0.3, z); scene.add(t);
  }
  for (const [x, y, z, s, seed] of [[-18, 18, -60, 4, 11], [10, 22, -80, 5, 12], [30, 15, -50, 3, 13], [-40, 24, -100, 6, 14], [0, 30, -120, 7, 15]]) {
    const c = makeCloud({ tone: 'cloudWhite', seed, puffs: 6 + (seed % 3), flatBottom: -0.1 }); c.position.set(x, y, z); c.scale.setScalar(s); scene.add(c);
    w.tick.push((dt) => { c.position.x += dt * 0.4; if (c.position.x > 90) c.position.x = -90; });
  }
  const rock = makeRock({ tone: 'stone', seed: 9, squash: [1.3, 0.6, 1] }); rock.position.set(5, hills(5, -6) + 0.2, -6); rock.scale.setScalar(1.3); scene.add(rock);
  w.anchors.rock = rock;
  if (pod) { const p = makePod(); p.scale.setScalar(2.4); p.position.set(-4, 9, -14); scene.add(p); w.tick.push(bob(p, 0.4, 0.6)); w.anchors.pod = p; }
  return rig(w, { pos: [0, 5, 22], look: [0, 6, -20], sway: [2, 0.8] });
}

/* ---------- GALAXY (Work): every project is its own planet ------------
   Planets sit on a sweeping arc, lit from the side by a low sun so each one is a
   cel-shaded crescent; painted nebula clouds fill the sky. w.planets[i] = { obj, pos, slug }.
   Also the Work window in the cockpit, so entering it lands you exactly here.  */
const PLANET_ORDER = ['bridgr', 'penumbra', 'veil', 'skindetect', 'rsashield', 'lowkei', 'undercurrent', 'prakriva', 'userpersonas', 'bakesbymom', 'solae'];
export const ORBIT = { cx: 19, cz: -20, rx: 23, rz: 15 };               // an orrery: every world on one tilted ellipse
export const PLANET_AT = (i, n) => {
  const a = (i / n) * Math.PI * 2 - 0.35;                                  // 01 sits front-left, the tour runs round to the right
  return new THREE.Vector3(ORBIT.cx + Math.sin(a) * ORBIT.rx, Math.sin(a * 2) * 1.6, ORBIT.cz + Math.cos(a) * ORBIT.rz);
};
function nebulaTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}
export function galaxy({ slugs = PLANET_ORDER } = {}) {
  const w = base('galaxy'), { scene } = w, r = rng(31);
  // nebula: big soft billboards far behind the planets, in the site's violets with a lime and coral breath
  const clouds = [
    [-120, 40, -230, 210, ['rgba(140,70,220,0.55)', 'rgba(90,40,170,0.25)', 'rgba(40,20,90,0)']],
    [60, 70, -260, 260, ['rgba(220,90,170,0.42)', 'rgba(150,50,160,0.2)', 'rgba(60,20,90,0)']],
    [160, -10, -220, 190, ['rgba(80,140,255,0.35)', 'rgba(60,70,200,0.16)', 'rgba(30,20,90,0)']],
    [-20, -60, -200, 170, ['rgba(123,245,131,0.16)', 'rgba(60,140,120,0.08)', 'rgba(20,40,60,0)']],
    [-200, -20, -170, 160, ['rgba(255,138,106,0.22)', 'rgba(170,70,120,0.1)', 'rgba(40,20,70,0)']],
  ];
  for (const [x, y, z, size, cols] of clouds) {
    const tex = nebulaTexture([[0, cols[0]], [0.45, cols[1]], [1, cols[2]]]);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    sp.scale.set(size, size, 1); sp.position.set(x, y, z); sp.userData.noInk = true; scene.add(sp);
  }
  // the sun: a hot disc low on the left, with a wide glow
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulaTexture([[0, 'rgba(255,236,200,1)'], [0.12, 'rgba(255,200,150,0.85)'], [0.35, 'rgba(255,140,120,0.25)'], [1, 'rgba(120,40,120,0)']]), transparent: true, depthWrite: false, fog: false }));
  glow.scale.set(120, 120, 1); glow.position.set(-170, 70, -150); glow.userData.noInk = true; scene.add(glow);
  // a few distant dust specks drifting
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + r() * 0.25, 0), toon('rock', { flat: 1 }));
    m.userData.flat = 1; m.position.set((r() - 0.5) * 120, (r() - 0.5) * 50, -20 - r() * 70); scene.add(m);
    w.tick.push(tumble(m, 0.2 + r() * 0.3));
  }
  // the orbit itself: a faint dashed ellipse through every world
  {
    const pts = []; for (let i = 0; i <= 240; i++) { const a = (i / 240) * Math.PI * 2; pts.push(new THREE.Vector3(ORBIT.cx + Math.sin(a) * ORBIT.rx, Math.sin(a * 2) * 1.6, ORBIT.cz + Math.cos(a) * ORBIT.rz)); }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: '#d6b8ff', dashSize: 0.9, gapSize: 1.1, transparent: true, opacity: 0.35, fog: false }));
    line.computeLineDistances(); line.userData.noInk = true; scene.add(line);
  }
  w.planets = slugs.map((slug, i) => {
    const obj = makeProjectPlanet(PLANETS[slug] || PLANETS.bridgr), pos = PLANET_AT(i, slugs.length);
    obj.position.copy(pos); scene.add(obj);
    const phase = r() * 6;
    const pl = { obj, pos, slug, scale: 1, scaleGoal: 1 };
    w.tick.push((dt, t) => {
      obj.userData.tick(dt); obj.position.y = pos.y + Math.sin(t * 0.35 + phase) * 0.25;
      pl.scale += (pl.scaleGoal - pl.scale) * (1 - Math.exp(-dt * 2.5)); obj.scale.setScalar(pl.scale);
    });
    return pl;
  });
  return rig(w, { pos: [-2, 29, 40], look: [9, -4, -18], sway: [2.2, 1.0], fov: 46 });
}

/* ---------- MOON (Work): a lunar plain, a gallery of monoliths ----------
   The monoliths stand along a gentle curve; w.slabs[i] = { group, screen, seam, pos }.
   The same world is the Work window in the cockpit and the Work page itself, so
   flying through the window lands you exactly where it looked.               */
export const SLAB_AT = (i) => new THREE.Vector3(i * 8.5, 0, -10 - i * 1.4 - Math.sin(i * 0.8) * 2.2);
export function moon({ slabs = 11 } = {}) {
  const w = base('moon'), { scene } = w, r = rng(9);
  const spots = Array.from({ length: slabs }, (_, i) => SLAB_AT(i));
  const craters = [[-14, -26, 9, 2.2], [22, -40, 12, 2.8], [52, -22, 7, 1.6], [-30, -60, 16, 3.4], [80, -52, 14, 3], [10, -8, 4, 0.9], [38, 2, 5, 1.1], [64, -6, 4.5, 1], [-6, 6, 3.5, 0.7], [100, -30, 9, 2]];
  const nearPath = (x, z) => spots.reduce((m, p) => Math.min(m, Math.hypot(x - p.x, z - p.z)), 1e9);
  const height = (x, z) => {
    let y = (fbm(x * 0.018 + 4, z * 0.018, 4) - 0.5) * 5 + Math.max(0, -z - 70) * 0.08;   // rolling, rising far away
    for (const [cx, cz, rr, dp] of craters) {
      const d = Math.hypot(x - cx, z - cz);
      if (d < rr) y -= dp * (1 - (d / rr) ** 2);
      y += dp * 0.4 * Math.exp(-(((d - rr) / (rr * 0.22)) ** 2));                          // the raised rim
    }
    const k = THREE.MathUtils.smoothstep(nearPath(x, z), 3, 7);                               // flat ground under the slabs
    return y * k;
  };
  w.height = height;
  scene.add(makeTerrain({ size: 320, depth: 260, seg: 220, height, tone: 'moon', cx: 40, cz: -70 }));

  // a coral ringed planet low over the horizon, and a thin second moon
  const giant = makeRingedPlanet({ radius: 24 }); giant.position.set(78, 10, -150); scene.add(giant);
  w.tick.push((dt) => { giant.children[0].rotation.y += dt * 0.01; });
  const moonlet = makePlanet({ radius: 4, tone: 'moon', seed: 7 }); moonlet.position.set(-38, 46, -170); scene.add(moonlet);

  // boulders, kept off the path
  for (let i = 0, n = 0; i < 300 && n < 34; i++) {
    const x = -40 + r() * 170, z = 8 - r() * 110;
    if (nearPath(x, z) < 6) continue;
    const b = makeRock({ seed: 70 + i, tone: r() > 0.5 ? 'moonDeep' : 'moon', squash: [1.3, 0.5 + r() * 0.3, 1.15] });
    const s = 0.3 + Math.pow(r(), 2.2) * 2.2; b.scale.setScalar(s);
    b.position.set(x, height(x, z) + s * 0.15, z); b.rotation.y = r() * 6; scene.add(b); n++;
  }

  // the monoliths
  w.slabs = spots.map((p, i) => {
    const m = makeMonolith(); m.pos = p.clone(); p.y = height(p.x, p.z);
    m.group.position.copy(p); m.group.rotation.y = -0.18 - i * 0.012;        // turned a touch toward the path's start
    scene.add(m.group); return m;
  });
  w.anchors.slabs = w.slabs.map((m) => m.group);
  return rig(w, { pos: [-13, 3.9, 13], look: [4, 2.6, -16], sway: [1.2, 0.5], fov: 42 });
}

/* ---------- PROPS: the 3D kit on a turntable ---------------------------- */
export function props() {
  const w = base('space'), { scene } = w;
  scene.fog.near = 200; scene.fog.far = 400;
  const items = [
    ['Pod', makePod(), 1.35], ['Asteroid', makeRock({ seed: 4 }), 1.1], ['Rock', makeRock({ tone: 'violet', seed: 8, squash: [1.2, 0.7, 1] }), 1],
    ['Shard', makeShard({ len: 2 }), 1], ['Gem', makeGem(), 1], ['Tree', makeTree(), 0.62], ['Cloud', makeCloud({ seed: 2 }), 0.5],
  ];
  items.forEach(([name, o, s], i) => {
    const x = (i - (items.length - 1) / 2) * 3.4;
    o.position.set(x, name === 'Tree' ? -1.3 : 0, 0); o.scale.multiplyScalar(s);
    scene.add(o); w.anchors[name] = o;
    w.tick.push((dt) => { o.rotation.y += dt * 0.4; });
  });
  return rig(w, { pos: [0, 1.2, 13.5], look: [0, 0.2, 0], sway: [0.6, 0.4], fov: 42 });
}

export const WORLDS = { space, water, earth, props, moon, galaxy, dusk: (o) => water({ ...o, night: true }), desert: (o) => earth({ ...o, desert: true }) };

