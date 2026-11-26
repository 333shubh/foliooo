import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, waterMaterial, skyMaterial, starMaterial } from './materials.js';

/* ---------- tiny deterministic noise ------------------------------------ */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
const smooth = (t) => t * t * (3 - 2 * t);
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; // 0..1
}
export const fbm = (x, y, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2; a *= 0.5; } return s; };

const mesh = (geo, mat, ud = {}) => { const m = new THREE.Mesh(geo, mat); Object.assign(m.userData, ud); return m; };

/* ---------- Sky, stars, constellations (never inked) -------------------- */
export function makeSky(colors, radius = 300) {
  return mesh(new THREE.SphereGeometry(radius, 32, 16), skyMaterial(colors), { noInk: true });
}

export function makeStars(count = 300, { radius = 250, minY = 0.05, seed = 7, density = 1 } = {}) {
  const r = rng(seed), pos = [], bright = [];
  for (let i = 0; i < count * density; i++) {
    const y = minY + r() * (1 - minY), a = r() * Math.PI * 2, rr = Math.sqrt(1 - y * y);
    pos.push(Math.cos(a) * rr * radius, y * radius, Math.sin(a) * rr * radius);
    bright.push(Math.pow(r(), 6) * 0.6 + 0.05);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aBright', new THREE.Float32BufferAttribute(bright, 1));
  const p = new THREE.Points(g, starMaterial());
  p.userData.noInk = true; p.frustumCulled = false;
  return p;
}

// A constellation = bright named stars joined by dashed lines.
// nodes: [{ name, pos: Vector3 }], links: [[i, j], ...]
export function makeConstellation(nodes, links, { color = '#ffffff' } = {}) {
  const group = new THREE.Group();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(nodes.flatMap((n) => n.pos.toArray()), 3));
  g.setAttribute('aBright', new THREE.Float32BufferAttribute(nodes.map((n) => n.bright ?? 0.9), 1));
  const stars = new THREE.Points(g, starMaterial(color));
  stars.frustumCulled = false;
  const lg = new THREE.BufferGeometry().setFromPoints(links.flatMap(([a, b]) => [nodes[a].pos, nodes[b].pos]));
  const lines = new THREE.LineSegments(lg, new THREE.LineDashedMaterial({ color, dashSize: 1.6, gapSize: 1.4, transparent: true, opacity: 0.55, depthWrite: false }));
  lines.computeLineDistances();
  group.add(lines, stars);
  group.userData.nodes = nodes;
  group.traverse((o) => { o.userData.noInk = true; });
  return group;
}

/* ---------- Cloud: merged puffs with a flat cartoon bottom -------------- */
export function makeCloud({ tone = 'cloudPink', puffs = 6, seed = 3, flatBottom = 0 } = {}) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < puffs; i++) {
    const t = puffs === 1 ? 0 : i / (puffs - 1) - 0.5;
    const s = (1 - Math.abs(t) * 1.1) * (0.8 + r() * 0.5);
    const g = new THREE.IcosahedronGeometry(s, 3);
    g.translate(t * puffs * 0.9, s * 0.35 + r() * 0.2, (r() - 0.5) * 0.6);
    parts.push(g);
  }
  const geo = mergeGeometries(parts);
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < flatBottom) { p.setY(i, flatBottom); n.setXYZ(i, 0, -1, 0); }
  geo.scale(1, 0.75, 0.7);
  return mesh(geo, toon(tone, { t1: -0.3, t2: 0.35 }), { noInk: true });
}

/* ---------- Asteroid / boulder: lumpy faceted rock ---------------------- */
export function makeRock({ tone = 'rock', seed = 1, detail = 1, lump = 0.35, squash = [1, 0.8, 1] } = {}) {
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const r = rng(seed), p = geo.attributes.position, v = new THREE.Vector3(), off = r() * 100;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + (noise2(v.x * 1.7 + off, v.y * 1.7 + v.z * 1.3) - 0.5) * 2 * lump;
    v.multiplyScalar(k).multiply(new THREE.Vector3(...squash));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return mesh(geo, toon(tone, { flat: 1, t1: 0.0, t2: 0.6 }), { flat: 1 });
}

/* ---------- Shard: the floating data crystal ---------------------------- */
export function makeShard({ tone = 'crystal', len = 1.4, w = 0.24 } = {}) {
  const geo = new THREE.BoxGeometry(w, len, w);
  return mesh(geo, toon(tone, { flat: 1, t1: -0.2, t2: 0.5 }), { flat: 1 });
}

/* ---------- Gem: lime polyhedron, the "found it" object ----------------- */
export function makeGem({ tone = 'lime', size = 1 } = {}) {
  const geo = new THREE.DodecahedronGeometry(size, 0);
  return mesh(geo, toon(tone, { flat: 1, t1: -0.25, t2: 0.45 }), { flat: 1 });
}

/* ---------- Pod: the explorer capsule (our hero object) ----------------- */
export function makePod() {
  const pod = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(1, 64, 40), toon('pod', { rim: 0.16, t1: -0.15, t2: 0.45 }));
  pod.add(body);
  // two windows wrapping the front, split by a mullion
  const win = (phiStart, phiLen) => mesh(new THREE.SphereGeometry(1.012, 40, 20, phiStart, phiLen, 0.72, 0.78), toon('glass', { t1: 0.2, t2: 0.75, rim: 0.0 }));
  pod.add(win(Math.PI / 2 - 1.05, 0.95), win(Math.PI / 2 + 0.12, 0.95));
  // glare stripe across the left window
  const glare = mesh(new THREE.SphereGeometry(1.016, 16, 8, Math.PI / 2 - 0.62, 0.16, 0.75, 0.7), new THREE.MeshBasicMaterial({ color: '#f3d2ff', transparent: true, opacity: 0.7 }), { inkGroup: 'glare', noInk: true });
  pod.add(glare);
  // hull bands below the windows
  for (const y of [-0.32, -0.6]) {
    const rr = Math.sqrt(1 - y * y);
    const band = mesh(new THREE.TorusGeometry(rr, 0.022, 8, 96), toon('lilac'), { inkGroup: 'bands' });
    band.rotation.x = Math.PI / 2; band.position.y = y; pod.add(band);
  }
  // thruster ring underneath
  const thr = mesh(new THREE.TorusGeometry(0.3, 0.07, 10, 48), toon({ shade: '#3a32c8', base: '#5a55f0', light: '#9a97ff' }));
  thr.rotation.x = Math.PI / 2; thr.position.y = -0.96; pod.add(thr);
  // antenna with a lime bead: the bit that makes it ours
  const stalk = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 8), toon('lilac'));
  stalk.position.set(0.25, 1.15, 0); stalk.rotation.z = -0.22; pod.add(stalk);
  const bead = mesh(new THREE.IcosahedronGeometry(0.07, 2), toon('lime', { rim: 0.2 }));
  bead.position.set(0.3, 1.37, 0); pod.add(bead);
  pod.userData.bead = bead;
  return pod;
}

/* ---------- Tree: round cartoon tree ------------------------------------ */
export function makeTree({ seed = 2, scale = 1 } = {}) {
  const r = rng(seed), g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 8), toon('trunk'));
  trunk.position.y = 0.7; g.add(trunk);
  const leaves = [];
  for (let i = 0; i < 3; i++) {
    const s = 0.75 + r() * 0.35;
    const b = new THREE.IcosahedronGeometry(s, 2);
    b.translate((r() - 0.5) * 0.7, 1.6 + i * 0.35 + r() * 0.2, (r() - 0.5) * 0.5);
    leaves.push(b);
  }
  g.add(mesh(mergeGeometries(leaves), toon('leaf', { t1: -0.1, t2: 0.5 })));
  g.scale.setScalar(scale);
  return g;
}

/* ---------- Terrain: heightfield, optional terraces --------------------- */
export function makeTerrain({ size = 220, depth = size, seg = 160, height, tone = 'teal', terrace = 0, cx = 0, cz = 0 } = {}) {
  const geo = new THREE.PlaneGeometry(size, depth, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + cx, z = p.getZ(i) + cz;
    let y = height(x, z);
    if (terrace > 0) { const f = y / terrace, fl = Math.floor(f); y = (fl + smooth(Math.min(1, (f - fl) * 3.5))) * terrace; }
    p.setY(i, y);
  }
  geo.translate(cx, 0, cz);
  geo.computeVertexNormals();
  return mesh(geo, toon(tone, { t1: 0.25, t2: 0.75 }));
}

export function makeWater({ size = 400, tone = 'water' } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, 1, 1); geo.rotateX(-Math.PI / 2);
  return mesh(geo, waterMaterial(tone));
}

/* ---------- Planet: a big curved horizon for space shots ---------------- */
export function makePlanet({ radius = 30, tone = 'planet', seed = 4 } = {}) {
  let geo = new THREE.IcosahedronGeometry(radius, 12);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv'); geo = mergeVertices(geo);
  const p = geo.attributes.position, v = new THREE.Vector3(), off = seed * 13;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const h = fbm(n.x * 3 + off, n.y * 3 + n.z * 2, 3);
    v.multiplyScalar(1 + Math.floor(h * 6) / 6 * 0.035); // stepped plateaus
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return mesh(geo, toon(tone, { t1: 0.35, t2: 0.82, rim: 0.05 }));
}

/* ---------- Ringed planet: latitude bands as separate cel pieces --------
   Each band is its own mesh, so the ink pass draws a crisp line between them. */
export function makeRingedPlanet({ radius = 20, bands = ['peach', 'coral', 'peach', 'coral', 'peach', 'coral', 'peach'], ring = 'ring', tilt = 0.32 } = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const cuts = [0, 0.22, 0.36, 0.47, 0.55, 0.66, 0.8, 1];       // uneven stripes read as weather
  bands.forEach((tone, i) => {
    const a = cuts[i] * Math.PI, b = cuts[i + 1] * Math.PI;
    body.add(mesh(new THREE.SphereGeometry(radius, 64, 12, 0, Math.PI * 2, a, b - a), toon(tone, { t1: 0.1, t2: 0.7, rim: 0.08 }), { inkGroup: 'gas' + (i % 2) }));
  });
  const disc = mesh(new THREE.RingGeometry(radius * 1.35, radius * 2.15, 128, 1), toon(ring, { side: THREE.DoubleSide, t1: -1 }));
  disc.rotation.x = -Math.PI / 2; g.add(disc);
  const gap = mesh(new THREE.RingGeometry(radius * 1.72, radius * 1.78, 128, 1), new THREE.MeshBasicMaterial({ color: '#7a5bc4', side: THREE.DoubleSide }), { noInk: true });
  gap.rotation.x = -Math.PI / 2; gap.position.y = 0.01; g.add(gap);
  g.rotation.z = tilt;
  return g;
}

/* ---------- Monolith: a dark slab with a screen in its face -------------
   Returns { group, screen } — put a texture on screen.material.map.        */
export function makeMonolith({ w = 2.6, h = 4.2, d = 0.32 } = {}) {
  const g = new THREE.Group();
  const slab = mesh(new THREE.BoxGeometry(w, h, d), toon('slab', { flat: 1, rim: 0.12 }), { flat: 1 });
  slab.position.y = h / 2; g.add(slab);
  const bezel = mesh(new THREE.BoxGeometry(w - 0.18, h - 0.5, 0.04), toon('rock', { flat: 1 }), { flat: 1 });
  bezel.position.set(0, h / 2 + 0.1, d / 2 + 0.01); g.add(bezel);
  const screen = mesh(new THREE.PlaneGeometry(w - 0.3, h - 0.62), new THREE.MeshBasicMaterial({ color: '#2a1a5c' }), { noInk: true });
  screen.position.set(0, h / 2 + 0.1, d / 2 + 0.035); g.add(screen);
  const seam = mesh(new THREE.BoxGeometry(w + 0.02, 0.05, d + 0.02), new THREE.MeshBasicMaterial({ color: '#7bf583' }), { noInk: true });
  seam.position.y = 0.16; g.add(seam);                                        // the lime light seam near the foot
  const plinth = mesh(new THREE.CylinderGeometry(w * 0.78, w * 0.9, 0.18, 7), toon('moonDeep', { flat: 1 }), { flat: 1 });
  plinth.position.y = -0.02; g.add(plinth);
  return { group: g, screen, seam };
}

/* ---------- Home planet: every terrain on one little globe -------------
   Lilac ocean, green hills with trees, red desert + mesas, violet mountains
   with crystals, a snowy south pole, and a flat launch pad on the north pole
   (the spin axis, so the pad stays put while the planet turns).
   Returns { root, spin, padTop } — rotate `spin` around its y axis.        */
const BIOME = {
  grass: new THREE.Color('#78c65e'), forest: new THREE.Color('#4fae5a'), beach: new THREE.Color('#f2cf9a'),
  sand: new THREE.Color('#e48a5a'), mesa: new THREE.Color('#b94f38'), rock: new THREE.Color('#8a68c0'),
  snow: new THREE.Color('#f4ecff'), pad: new THREE.Color('#9fd98a'),
};
export function makeHomePlanet({ radius: R = 6, seed = 3, sites = [], freq = 1, detail = 38, poleCos = 0.86, padCos = 0.955, capCos = -1, trees = 46, weather = true, relief = 1, treeRate = 1, lot = 0.2 } = {}) {
  // big-planet mode: raise freq + detail, shrink poleCos/padCos to the pad, set capCos to the visible cap
  // sites: [{ obj, dir: Vector3, scale }]: landmarks; the land under each is kept dry and gentle
  const root = new THREE.Group(), spin = new THREE.Group(); root.add(spin);
  const off = seed * 7.3, sky_ = weather;
  // tri-planar fbm: noise on three planes, so continents don't streak along an axis
  const fbm3 = (d, f, o = 0) => { f *= freq; return (fbm(d.x * f + o, d.y * f - o, 4) + fbm(d.y * f + 5 + o, d.z * f, 4) + fbm(d.z * f - 9, d.x * f + o, 4)) / 3; };

  let geo = new THREE.IcosahedronGeometry(R, detail);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv'); geo = mergeVertices(geo);
  const p = geo.attributes.position, n = p.count, d = new THREE.Vector3();
  const H = new Float32Array(n), DRY = new Float32Array(n), WOOD = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(p, i).normalize();
    H[i] = fbm3(d, 1.5, off); DRY[i] = fbm3(d, 1.7, off + 11); WOOD[i] = fbm3(d, 2.6, off + 3);
  }
  // sea level by quantile → roughly 60% land on every seed
  const quant = (arr, t) => { const s = Float32Array.from(arr).sort(); return s[Math.floor(t * (s.length - 1))]; };
  const sea = quant(H, 0.4), top = quant(H, 0.985), dryCut = quant(DRY, 0.62), woodCut = quant(WOOD, 0.55);
  // north pole: a gentle green field around the pad, flush with the land
  for (let i = 0; i < n; i++) { d.fromBufferAttribute(p, i).normalize(); if (d.y > poleCos) H[i] = sea + (top - sea) * (0.3 + (0.95 - Math.min(0.95, d.y)) * 0.8); }
  const siteDirs = sites.map((st) => st.dir.clone().normalize());
  const nearSite = (v, ang = 0.2) => siteDirs.some((sd) => v.angleTo(sd) < ang);
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(p, i).normalize();
    if (nearSite(d, lot * 1.2)) H[i] = Math.max(H[i], sea + (top - sea) * 0.22);
    if (nearSite(d, lot * 0.6)) H[i] = sea + (top - sea) * 0.25;           // flat lot to build on
  }

  // biome of a point: { k: radius multiplier, c: colour, kind }
  const biome = (dy, h, dr, wd) => {
    if (h < sea) return { k: 0.95, c: BIOME.sand, kind: 'sea' };
    const land = Math.min(1, (h - sea) / (top - sea));
    if (dy > padCos) return { k: 1.025 + 0.3 * 0.08, c: BIOME.pad, kind: 'pad' };
    if (dy > poleCos) return { k: 1.025 + land * 0.08, c: BIOME.grass, kind: 'grass' };
    if (dy < -0.82) return { k: 1.02 + land * 0.1, c: BIOME.snow, kind: 'snow' };
    if (land < 0.07) return { k: 1.015, c: BIOME.beach, kind: 'beach' };
    if (land > 0.62) return { k: 1.05 + land * 0.14, c: BIOME.rock, kind: 'rock' };
    if (dr > dryCut) { const step = Math.floor(land * 8) / 8; return { k: 1.02 + step * 0.14, c: step > 0.2 ? BIOME.mesa : BIOME.sand, kind: 'desert' }; }
    return { k: 1.025 + land * 0.08, c: wd > woodCut ? BIOME.forest : BIOME.grass, kind: wd > woodCut ? 'forest' : 'grass' };
  };
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(p, i).normalize();
    const k = 1 + (biome(d.y, H[i], DRY[i], WOOD[i]).k - 1) * relief;
    p.setXYZ(i, d.x * R * k, d.y * R * k, d.z * R * k);
  }
  geo.computeVertexNormals();

  // colour per face (not per vertex) so regions read as crisp painted patches
  const idx = geo.index.array, faces = idx.length / 3, flat = geo.toNonIndexed();
  const col = new Float32Array(faces * 9), spots = { trees: [], rocks: [], crystals: [] }, chance = rng(seed + 99), cen = new THREE.Vector3();
  for (let f = 0; f < faces; f++) {
    const a = idx[f * 3], b = idx[f * 3 + 1], c = idx[f * 3 + 2];
    cen.fromBufferAttribute(p, a).add(d.fromBufferAttribute(p, b)).add(d.fromBufferAttribute(p, c)).divideScalar(3);
    const dir = cen.clone().normalize();
    const bm = biome(dir.y, (H[a] + H[b] + H[c]) / 3, (DRY[a] + DRY[b] + DRY[c]) / 3, (WOOD[a] + WOOD[b] + WOOD[c]) / 3);
    for (let v = 0; v < 3; v++) col.set([bm.c.r, bm.c.g, bm.c.b], f * 9 + v * 3);
    const roll = dir.y > capCos ? chance() : 1;
    if (bm.kind === 'forest' && roll < 0.05 * treeRate) spots.trees.push(cen.clone());
    else if (bm.kind === 'grass' && roll < 0.008 * treeRate) spots.trees.push(cen.clone());
    else if (bm.kind === 'desert' && roll < 0.012) spots.rocks.push(cen.clone());
    else if (bm.kind === 'rock' && roll < 0.03) spots.crystals.push(cen.clone());
  }
  flat.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const land = mesh(flat, toon('violet', { vertexColors: true, t1: 0.0, t2: 0.62, rim: 0.08 }), { inkGroup: 'planet' });
  const ocean = mesh(new THREE.SphereGeometry(R * 1.0, 64, 48), toon({ shade: '#5a44c8', base: '#7d68ee', light: '#ad9cff' }, { t1: -0.1, t2: 0.6, rim: 0.12 }));
  spin.add(land, ocean);

  // props, standing on the surface along its normal
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
  const plant = (o, at, s) => { q.setFromUnitVectors(up, at.clone().normalize()); o.quaternion.copy(q); o.position.copy(at); o.scale.multiplyScalar(s); spin.add(o); };
  const r = rng(seed);
  const clear = (list) => list.filter((v) => !nearSite(v.clone().normalize(), lot) && v.clone().normalize().y < Math.cos(Math.acos(padCos) * 4));
  spots.trees = clear(spots.trees); spots.rocks = clear(spots.rocks); spots.crystals = clear(spots.crystals);
  // landmarks: drop each one straight down onto the surface
  const ray = new THREE.Raycaster();
  land.updateMatrixWorld(true);
  sites.forEach((st) => {
    const dir = st.dir.clone().normalize();
    ray.set(dir.clone().multiplyScalar(R * 2), dir.clone().negate());
    const hit = ray.intersectObject(land)[0];
    plant(st.obj, hit ? hit.point : dir.multiplyScalar(R * 1.03), st.scale ?? 0.75);
  });
  spots.trees.slice(0, trees).forEach((at, i) => plant(makeTree({ seed: i + 1 }), at, 0.16 + r() * 0.08));
  spots.rocks.slice(0, 14).forEach((at, i) => plant(makeRock({ tone: 'mesa', seed: i + 30, squash: [1.3, 0.6, 1] }), at, 0.18 + r() * 0.12));
  spots.crystals.slice(0, 12).forEach((at, i) => plant(makeShard({ tone: i % 3 ? 'crystal' : 'lime', len: 1.2, w: 0.22 }), at, 0.45 + r() * 0.3));

  // launch pad on the north pole
  const padY = R * (1 + (0.025 + 0.3 * 0.08) * relief);
  const pad = mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.16, 40), toon('metal'));
  pad.position.y = padY + 0.08; spin.add(pad);
  const ring = mesh(new THREE.TorusGeometry(0.78, 0.05, 8, 48), toon('lime', { rim: 0.2 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = padY + 0.17; spin.add(ring);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4, light = mesh(new THREE.IcosahedronGeometry(0.07, 2), toon('lime'));
    light.position.set(Math.cos(a) * 1.0, padY + 0.18, Math.sin(a) * 1.0); spin.add(light);
  }

  // weather + a moon: clouds drift on tilted orbits, the lime gem circles the planet
  const sky = new THREE.Group(); root.add(sky);
  for (let i = 0; i < (sky_ ? 6 : 0); i++) {
    const orbit = new THREE.Group(); orbit.rotation.set((r() - 0.5) * 1.2, r() * 6, (r() - 0.5) * 0.8);
    const cl = makeCloud({ tone: 'cloudWhite', seed: i + 5, puffs: 4 + (i % 3), flatBottom: -0.05 });
    cl.scale.setScalar(0.32 + r() * 0.18); cl.position.set(R * 1.32, 0, 0); cl.rotation.y = Math.PI / 2;
    orbit.add(cl); sky.add(orbit); orbit.userData.speed = 0.05 + r() * 0.06;
  }
  const moonOrbit = new THREE.Group(); moonOrbit.rotation.set(0.35, 0, -0.25); if (sky_) root.add(moonOrbit);
  const moon = makeGem({ size: 0.55 }); moon.position.set(R * 1.75, 0, 0); moonOrbit.add(moon);
  const path = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos(i / 128 * Math.PI * 2) * R * 1.75, 0, Math.sin(i / 128 * Math.PI * 2) * R * 1.75))),
    new THREE.LineDashedMaterial({ color: '#f6e8ff', dashSize: 0.25, gapSize: 0.22, transparent: true, opacity: 0.45 }));
  path.computeLineDistances(); path.userData.noInk = true; moonOrbit.add(path);

  root.userData.tick = (dt) => {
    sky.children.forEach((o) => o.rotateY(dt * o.userData.speed));
    moonOrbit.rotateY(dt * 0.25); moon.rotation.x += dt * 0.6; moon.rotation.y += dt * 0.4;
  };
  return { root, spin, padTop: new THREE.Vector3(0, padY + 0.16, 0) };
}
