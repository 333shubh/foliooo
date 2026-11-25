import * as THREE from 'three';
import { worlds as PALETTE } from './palette.js';
import { setLight } from './materials.js';
import {
  rng, fbm, noise2, makeSky, makeStars, makeConstellation, makeCloud, makeRock,
  makeShard, makeGem, makePod, makeTree, makeTerrain, makeWater, makePlanet,
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
  planet.position.set(-26, -40, -14); scene.add(planet);
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

export const WORLDS = { space, water, earth, props, dusk: (o) => water({ ...o, night: true }), desert: (o) => earth({ ...o, desert: true }) };

// Work categories → worlds (the cockpit windows, the Work page filters, case-study skies)
export const CATEGORY_WORLDS = {
  development: { world: 'earth', title: 'Development', line: 'Things that run on solid ground' },
  uiux: { world: 'water', title: 'UI/UX Design', line: 'Interfaces that flow' },
  graphic: { world: 'desert', title: 'Graphic Design', line: 'Bold shapes in hard light' },
  branding: { world: 'space', title: 'Branding', line: 'Identities built to launch' },
  research: { world: 'dusk', title: 'Research', line: 'Finding the stars between the data' },
};
