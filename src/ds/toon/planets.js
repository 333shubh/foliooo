import * as THREE from 'three';
import { toon } from './materials.js';
import { fbm, noise2 } from './props.js';

/* ==========================================================================
   Project planets: every project is its own little world, painted from its
   brand. One colour per triangle (crisp, toony patch edges), smooth normals,
   so the toon light still draws a clean day / night terminator.
     paint:  'bands' | 'continents' | 'patches' | 'stripes' | 'grid' | 'ocean'
     extras: ring, moons, cap (polar), veil (a cloud shell), spin
   ========================================================================== */
const C = (h) => new THREE.Color(h);
const n3 = (d, f, o = 0) => (fbm(d.x * f + o, d.y * f - o, 3) + fbm(d.y * f + 7 + o, d.z * f, 3) + fbm(d.z * f - 3, d.x * f + o, 3)) / 3;

const PAINT = {
  bands: (d, s) => { const y = d.y + (n3(d, 2.2, s.seed) - 0.5) * 0.35; const L = s.colors.length, i = ((Math.floor((y + 1) * 0.5 * L * 1.6) % L) + L) % L; return s.colors[i]; },
  continents: (d, s) => { const h = n3(d, s.freq || 1.6, s.seed); return h > 0.56 ? s.colors[2] ?? s.colors[1] : h > 0.47 ? s.colors[1] : s.colors[0]; },
  patches: (d, s) => { const h = n3(d, 2.4, s.seed), k = n3(d, 1.3, s.seed + 40), L = s.colors.length; return s.colors[((Math.floor((h * 0.6 + k * 0.7) * L * 1.4) % L) + L) % L]; },
  stripes: (d, s) => { const t = (Math.atan2(d.z, d.x) / Math.PI) * 3 + d.y * 2.2; return s.colors[((Math.floor(t * 2) % s.colors.length) + s.colors.length) % s.colors.length]; },
  grid: (d, s) => { const lon = Math.atan2(d.z, d.x), lat = Math.asin(d.y); const g = Math.abs(Math.sin(lon * 6)) < 0.08 || Math.abs(Math.sin(lat * 6)) < 0.08; return g ? s.colors[1] : (n3(d, 1.8, s.seed) > 0.58 ? s.colors[2] ?? s.colors[0] : s.colors[0]); },
  ocean: (d, s) => { const h = n3(d, 2.0, s.seed); return h > 0.6 ? s.colors[2] : h > 0.54 ? s.colors[1] : s.colors[0]; },
};

export function makeProjectPlanet(style) {
  const s = { seed: 1, size: 3, detail: 26, spin: 0.08, ...style };
  s.colors = s.colors.map(C);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);

  // the sphere: non-indexed, so each triangle can carry one flat colour
  const geo = new THREE.IcosahedronGeometry(s.size, s.detail);
  const p = geo.attributes.position, cols = new Float32Array(p.count * 3), nrm = new Float32Array(p.count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
  const capC = s.cap ? C(s.cap.color) : null;
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    m.copy(a).add(b).add(c).normalize();
    let col = PAINT[s.paint](m, s);
    if (capC && Math.abs(m.y) > s.cap.at + (noise2(m.x * 6 + s.seed, m.z * 6) - 0.5) * 0.12 && (s.cap.both || m.y > 0)) col = capC;
    for (let k = 0; k < 3; k++) {
      cols.set([col.r, col.g, col.b], (i + k) * 3);
      a.fromBufferAttribute(p, i + k).normalize(); nrm.set([a.x, a.y, a.z], (i + k) * 3);
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const sphere = new THREE.Mesh(geo, toon('violet', { vertexColors: true, t1: 0.12, t2: 0.62, rim: 0.12 }));
  body.add(sphere);

  // a soft cloud veil: a slightly bigger shell, broken into wisps
  if (s.veil) {
    const vg = new THREE.IcosahedronGeometry(s.size * 1.045, 10), vp = vg.attributes.position;
    const keep = [];
    for (let i = 0; i < vp.count; i += 3) {
      m.fromBufferAttribute(vp, i).normalize();
      if (n3(m, 3.1, s.seed + 9) > (s.veil.cover ?? 0.56)) for (let k = 0; k < 3; k++) { a.fromBufferAttribute(vp, i + k); keep.push(a.x, a.y, a.z); }
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); cg.computeVertexNormals();
    const clouds = new THREE.Mesh(cg, toon(s.veil.tone || 'cloudWhite', { t1: -0.2, t2: 0.5 }));
    clouds.userData.noInk = true; body.add(clouds); root.userData.clouds = clouds;
  }

  // rings: a flat disc, tilted with the planet
  if (s.ring) {
    const r = s.ring;
    const disc = new THREE.Mesh(new THREE.RingGeometry(s.size * r.inner, s.size * r.outer, 96, 1), toon({ shade: r.color, base: r.color, light: r.light || r.color }, { side: THREE.DoubleSide, t1: -1 }));
    disc.rotation.x = -Math.PI / 2; body.add(disc);
    if (r.gap) { const g = new THREE.Mesh(new THREE.RingGeometry(s.size * r.gap, s.size * (r.gap + 0.04), 96, 1), new THREE.MeshBasicMaterial({ color: r.gapColor || '#160923', side: THREE.DoubleSide })); g.rotation.x = -Math.PI / 2; g.position.y = 0.005; g.userData.noInk = true; body.add(g); }
  }
  body.rotation.z = s.tilt ?? 0.25;

  // moons on their own little orbits
  root.userData.moons = (s.moons || []).map((mo, i) => {
    const pivot = new THREE.Group(); pivot.rotation.set(mo.incl ?? 0.3, i * 1.7, 0); root.add(pivot);
    const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(s.size * mo.r, 3), toon({ shade: mo.shade || mo.color, base: mo.color, light: mo.light || mo.color }, { flat: mo.flat ? 1 : 0, rim: 0.1 }));
    moon.userData.flat = mo.flat ? 1 : 0;
    moon.position.x = s.size * mo.dist; pivot.add(moon);
    return { pivot, speed: mo.speed ?? 0.3 };
  });

  root.userData.tick = (dt) => {
    sphere.rotation.y += dt * s.spin;
    if (root.userData.clouds) root.userData.clouds.rotation.y += dt * s.spin * 1.4;
    root.userData.moons.forEach((mo) => { mo.pivot.rotation.y += dt * mo.speed; });
  };
  root.userData.size = s.size;
  return root;
}

/* each project's world, painted from its own landing page */
export const PLANETS = {
  bridgr:       { paint: 'bands', colors: ['#0b1220', '#12233a', '#1fd1c1', '#0b1220', '#173452'], size: 3.0, seed: 3, ring: { inner: 1.35, outer: 1.75, color: '#1fd1c1', light: '#9ff5ec' }, tilt: 0.35 },
  penumbra:     { paint: 'patches', colors: ['#ffe23a', '#2fc95a', '#ff3b3b', '#ffe23a', '#5b6cff'], size: 3.3, seed: 8, moons: [{ r: 0.22, dist: 1.9, color: '#16181c', speed: 0.35, incl: 0.15 }], tilt: 0.1 },
  veil:         { paint: 'continents', colors: ['#fbd98f', '#ff7aa8', '#7bb6ff'], size: 2.8, seed: 5, veil: { tone: 'cloudWhite', cover: 0.55 }, tilt: 0.2 },
  skindetect:   { paint: 'continents', colors: ['#5c1430', '#8e2a4a', '#f3d9c9'], freq: 2.2, size: 2.6, seed: 12, cap: { color: '#fbeee6', at: 0.82, both: true }, ring: { inner: 1.4, outer: 1.5, color: '#f3d9c9' }, tilt: -0.3 },
  rsashield:    { paint: 'grid', colors: ['#eef3ff', '#3a6cff', '#c9d8ff'], size: 3.1, seed: 2, moons: [{ r: 0.16, dist: 1.8, color: '#3a6cff', speed: 0.5, flat: true }], tilt: 0.18 },
  lowkei:       { paint: 'continents', colors: ['#141414', '#262222', '#f3eadb'], freq: 1.3, size: 2.7, seed: 14, moons: [{ r: 0.2, dist: 2.0, color: '#f3eadb', speed: 0.22, incl: 0.4 }], tilt: 0.3 },
  undercurrent: { paint: 'bands', colors: ['#f4f4f2', '#e2e2de', '#f4f4f2', '#bfc3c9', '#f4f4f2'], size: 2.4, seed: 6, veil: { tone: 'white', cover: 0.6 }, tilt: 0.05 },
  prakriva:     { paint: 'continents', colors: ['#c98aa0', '#7a2a44', '#6f9a5a'], freq: 1.8, size: 2.9, seed: 9, veil: { tone: 'cloudPink', cover: 0.6 }, tilt: 0.22 },
  userpersonas: { paint: 'bands', colors: ['#ff8a1f', '#ffd23a', '#1a1414', '#ff8a1f', '#ff5a3c'], size: 3.0, seed: 4, tilt: 0.28,
    moons: ['#7bf583', '#ff5a3c', '#3aa0ff', '#ffd23a', '#c86bff', '#f6f0e6', '#ff8ac0'].map((color, i) => ({ r: 0.1, dist: 1.55 + i * 0.12, color, speed: 0.25 + i * 0.05, incl: (i - 3) * 0.12 })) },
  bakesbymom:   { paint: 'stripes', colors: ['#f7b6c8', '#bfe0ff', '#fff3e6', '#bfe0ff'], size: 2.9, seed: 7, cap: { color: '#fffaf2', at: 0.62 }, moons: [{ r: 0.17, dist: 1.75, color: '#d7263d', speed: 0.4 }], tilt: 0.15 },
  solae:        { paint: 'ocean', colors: ['#1fb5b0', '#f6d7a0', '#ffc94a'], size: 3.0, seed: 11, veil: { tone: 'cloudWhite', cover: 0.62 }, ring: { inner: 1.5, outer: 1.62, color: '#ff8a6a' }, tilt: -0.2 },
};
