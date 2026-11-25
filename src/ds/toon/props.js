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
