import * as THREE from 'three';
import { base, rig, bob } from './worlds.js';
import { toon } from './materials.js';
import { rng, fbm, makeTerrain, makeCloud, makeTree, makeWater, makeStars } from './props.js';

/* ==========================================================================
   Places for the inner pages. Each is also that page's cockpit window, so
   entering a window lands you exactly where it was looking.
     meadow  About: golden-hour hills, wind turbines on the ridge, kites, a path
     lagoon  Contact: a lilac lagoon at dusk, a wooden pier, lanterns, a bottle
   ========================================================================== */
const T = (shade, base, light) => ({ shade, base, light });
const mesh = (geo, mat, ud = {}) => { const m = new THREE.Mesh(geo, mat); Object.assign(m.userData, ud); return m; };
const glowTex = (inner, outer) => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
};
const glow = (size, inner, outer = 'rgba(255,200,120,0)') => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(inner, outer), transparent: true, depthWrite: false, fog: false }));
  s.scale.set(size, size, 1); s.userData.noInk = true; return s;
};

/* ---------------- props ---------------- */
export function makeTurbine() {
  const g = new THREE.Group(), white = toon(T('#c9b8d8', '#f4ecf6', '#ffffff'));
  const mast = mesh(new THREE.CylinderGeometry(0.09, 0.2, 6, 10), white); mast.position.y = 3; g.add(mast);
  const hub = new THREE.Group(); hub.position.set(0, 6.05, 0.22); g.add(hub);
  hub.add(mesh(new THREE.BoxGeometry(0.34, 0.3, 0.7), white));
  const rotor = new THREE.Group(); rotor.position.z = 0.4; hub.add(rotor);
  rotor.add(mesh(new THREE.SphereGeometry(0.14, 12, 8), white));
  for (let i = 0; i < 3; i++) {
    const blade = mesh(new THREE.BoxGeometry(0.16, 2.9, 0.05), white); blade.position.y = 1.5;
    const arm = new THREE.Group(); arm.rotation.z = (i / 3) * Math.PI * 2; arm.add(blade); rotor.add(arm);
  }
  g.userData.rotor = rotor;
  return g;
}
export function makeKite(color = '#ff7a8a', tail = '#ffd27a') {
  const g = new THREE.Group();
  const shape = new THREE.Shape(); shape.moveTo(0, 0.7); shape.lineTo(0.48, 0); shape.lineTo(0, -0.9); shape.lineTo(-0.48, 0); shape.closePath();
  g.add(mesh(new THREE.ShapeGeometry(shape), toon(T(color, color, color), { side: THREE.DoubleSide, t1: -1 })));
  const pts = []; for (let i = 0; i <= 14; i++) pts.push(new THREE.Vector3(Math.sin(i * 0.9) * 0.18, -0.9 - i * 0.22, 0));
  const tailLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: tail }));
  tailLine.userData.noInk = true; g.add(tailLine);
  g.userData.tail = tailLine;
  return g;
}
export function makePier(len = 16) {
  const g = new THREE.Group(), wood = toon(T('#4e2f45', '#7d4f5e', '#b9808a'), { flat: 1 }), post = toon(T('#3b2236', '#5e3a4c', '#8a5a6a'));
  for (let i = 0; i < len; i++) {
    const plank = mesh(new THREE.BoxGeometry(2.6, 0.12, 0.82), wood, { flat: 1 }); plank.position.set((i % 2 ? 0.04 : -0.04), 0, -i * 0.9); plank.rotation.y = (i % 3 - 1) * 0.015; g.add(plank);
  }
  for (let i = 0; i < len; i += 3) for (const x of [-1.2, 1.2]) { const p = mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.4, 8), post); p.position.set(x, -0.9, -i * 0.9); g.add(p); }
  return g;
}
export function makeLantern() {
  const g = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), toon(T('#2a1730', '#3d2442', '#5e3a5e'))); pole.position.y = 1.1; g.add(pole);
  const lamp = mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), new THREE.MeshBasicMaterial({ color: '#ffd98a' }), { noInk: true }); lamp.position.y = 2.35; g.add(lamp);
  const cap = mesh(new THREE.ConeGeometry(0.3, 0.22, 4), toon(T('#2a1730', '#3d2442', '#5e3a5e'))); cap.position.y = 2.66; cap.rotation.y = Math.PI / 4; g.add(cap);
  const halo = glow(2.6, 'rgba(255,214,140,0.85)'); halo.position.y = 2.35; g.add(halo);
  g.userData.halo = halo;
  return g;
}
export function makeBottle() {
  const g = new THREE.Group(), glass = toon(T('#3f9a8a', '#7fd6c2', '#d6fff4'), { rim: 0.3 });
  const body = mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.8, 14), glass); body.rotation.z = Math.PI / 2; g.add(body);
  const neck = mesh(new THREE.CylinderGeometry(0.09, 0.16, 0.34, 12), glass); neck.rotation.z = Math.PI / 2; neck.position.x = 0.55; g.add(neck);
  const cork = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 10), toon(T('#8a5a3a', '#c08a5a', '#e8b98a'))); cork.rotation.z = Math.PI / 2; cork.position.x = 0.76; g.add(cork);
  const note = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 10), toon(T('#d8cbb0', '#f6ecd6', '#ffffff'))); note.rotation.z = Math.PI / 2; g.add(note);
  return g;
}
export function makePaperBoat(color = '#f6ecd6') {
  const g = new THREE.Group(), paper = toon(T('#c9bfd8', color, '#ffffff'), { flat: 1, side: THREE.DoubleSide });
  const hull = mesh(new THREE.CylinderGeometry(0.5, 0.22, 0.28, 4, 1, true), paper, { flat: 1 }); hull.rotation.y = Math.PI / 4; hull.scale.set(1.6, 1, 0.7); g.add(hull);
  const sail = mesh(new THREE.ConeGeometry(0.34, 0.6, 4), paper, { flat: 1 }); sail.position.y = 0.38; sail.scale.z = 0.25; g.add(sail);
  return g;
}

/* ---------------- MEADOW (About) ---------------- */
export const MEADOW_PATH = [[-2, 18], [3, 8], [-1, -2], [5, -12], [2, -22], [7, -32], [4, -42]];
export function meadow() {
  const w = base('golden'), { scene } = w, r = rng(17);
  const path = new THREE.CatmullRomCurve3(MEADOW_PATH.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const pathPts = path.getSpacedPoints(120);
  const toPath = (x, z) => pathPts.reduce((m, p) => Math.min(m, Math.hypot(x - p.x, z - p.z)), 1e9);
  // hills that climb toward the ridge, with the path pressed gently into them
  const height = (x, z) => {
    const climb = Math.max(0, -z + 18) * 0.13;
    const roll = (fbm(x * 0.03 + 2, z * 0.03, 4) - 0.5) * 7;
    const sides = Math.max(0, Math.abs(x) - 14) * 0.12;
    const cut = 1 - Math.exp(-((toPath(x, z) / 2.2) ** 2)) * 0.35;
    return (climb + roll + sides) * cut;
  };
  w.height = height;
  scene.add(makeTerrain({ size: 200, depth: 200, seg: 200, height, tone: T('#3f7a46', '#78b45a', '#cfe07a'), cz: -30 }));
  // far ridges in dusky lilac
  scene.add(makeTerrain({ size: 400, depth: 200, seg: 90, height: (x, z) => Math.max(0, fbm(x * 0.012, z * 0.012, 4) - 0.3) * 60 + Math.max(0, -z - 120) * 0.15, tone: T('#7d5fa6', '#a58ac8', '#d8c2ec'), cz: -220 }));
  // the path: a sandy ribbon laid on the ground
  {
    const left = [], right = [];
    pathPts.forEach((p, i) => {
      const n = pathPts[Math.min(i + 1, pathPts.length - 1)].clone().sub(pathPts[Math.max(i - 1, 0)]).normalize();
      const side = new THREE.Vector3(-n.z, 0, n.x).multiplyScalar(0.9);
      const a = p.clone().add(side), b = p.clone().sub(side);
      a.y = height(a.x, a.z) + 0.06; b.y = height(b.x, b.z) + 0.06; left.push(a); right.push(b);
    });
    const pos = []; for (let i = 0; i < left.length - 1; i++) pos.push(...left[i].toArray(), ...right[i].toArray(), ...left[i + 1].toArray(), ...right[i].toArray(), ...right[i + 1].toArray(), ...left[i + 1].toArray());
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    scene.add(mesh(g, toon(T('#c08a5a', '#e8b98a', '#ffe0b0'), { side: THREE.DoubleSide })));
  }
  // trees and tall grass, kept off the path
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * 70, z = 10 - r() * 80; if (toPath(x, z) < 6 || x < -4) continue;
    const t = makeTree({ seed: i + 3, scale: 0.8 + r() * 0.9 }); t.position.set(x, height(x, z) - 0.2, z); scene.add(t);
  }
  const blade = new THREE.ConeGeometry(0.06, 0.9, 3); blade.translate(0, 0.45, 0);
  const grass = new THREE.InstancedMesh(blade, toon(T('#4f8a4a', '#8cc45e', '#e3ec8a')), 1400);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < 4000 && n < 1400; i++) {
    const x = (r() - 0.5) * 40, z = 16 - r() * 66; if (toPath(x, z) < 1.4) continue;
    ps.set(x, height(x, z) - 0.05, z); q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.4, r() * 6, (r() - 0.5) * 0.4)); sc.setScalar(0.6 + r() * 0.9);
    m4.compose(ps, q, sc); grass.setMatrixAt(n++, m4);
  }
  grass.count = n; grass.userData.noInk = true; scene.add(grass);
  // wind turbines along the ridge, turning slowly
  const turbines = [[-16, -46], [-6, -54], [6, -50], [17, -58], [28, -48]].map(([x, z], i) => {
    const t = makeTurbine(); t.position.set(x, height(x, z) - 0.3, z); t.rotation.y = 0.2 - i * 0.05; t.scale.setScalar(1.3); scene.add(t);
    const spd = 0.5 + r() * 0.4; w.tick.push((dt) => { t.userData.rotor.rotation.z -= dt * spd; });
    return t;
  });
  w.turbines = turbines;
  // kites on the wind
  [['#ff7a8a', '#ffd27a', -6, 14, -14], ['#7bf583', '#ffffff', 9, 18, -26], ['#7a8cff', '#ff9ad0', -2, 22, -38]].forEach(([c, tl, x, y, z], i) => {
    const k = makeKite(c, tl); k.position.set(x, y, z); k.scale.setScalar(1.4); scene.add(k);
    w.tick.push((dt, t) => { k.position.x = x + Math.sin(t * 0.4 + i) * 1.4; k.position.y = y + Math.sin(t * 0.7 + i * 2) * 0.8; k.rotation.z = Math.sin(t * 0.9 + i) * 0.25; });
  });
  // soft golden clouds
  for (const [x, y, z, s, seed] of [[-30, 26, -80, 5, 2], [20, 30, -100, 6, 4], [50, 22, -70, 4, 6], [-60, 34, -120, 7, 8]]) {
    const c = makeCloud({ tone: 'cloudPink', seed, puffs: 7, flatBottom: -0.1 }); c.position.set(x, y, z); c.scale.setScalar(s); scene.add(c);
    w.tick.push((dt) => { c.position.x += dt * 0.3; if (c.position.x > 90) c.position.x = -90; });
  }
  // the low sun
  const sun = glow(70, 'rgba(255,236,200,1)', 'rgba(255,170,120,0)'); sun.position.set(80, 18, -170); scene.add(sun);
  w.path = path;
  const start = path.getPointAt(0);
  return rig(w, { pos: [start.x - 2, height(start.x, start.z) + 3.2, start.z + 9], look: [3, 6, -30], sway: [1.4, 0.6], fov: 50 });
}

/* ---------------- LAGOON (Contact) ---------------- */
export function lagoon() {
  const w = base('lagoon'), { scene } = w, r = rng(23);
  const water = makeWater({ tone: 'water' }); scene.add(water);
  w.tick.push((dt, t) => { water.material.uniforms.uTime.value = t; });
  scene.add(makeStars(180, { density: 1, minY: 0.18, seed: 5 }));
  // teal cliffs around the bay, open toward the horizon
  const height = (x, z) => {
    const ring = Math.hypot(x * 0.8, (z + 40) * 1.2);
    const bay = THREE.MathUtils.smoothstep(ring, 34, 60);
    return -1.4 + bay * (8 + fbm(x * 0.05, z * 0.05, 4) * 22) * (z < -60 ? 0.5 : 1);
  };
  scene.add(makeTerrain({ size: 260, seg: 160, height, tone: 'teal', cz: -50 }));
  // the pier reaching into the lagoon, with lanterns
  const pier = makePier(18); pier.position.set(-3, 0.35, 12); pier.rotation.y = 0.12; scene.add(pier);
  w.lanterns = [0, 6, 12, 17].map((i, k) => {
    const l = makeLantern(); l.position.set(-3 + (k % 2 ? 1.25 : -1.25) - i * 0.1, 0.4, 12 - i * 0.9); scene.add(l);
    w.tick.push((dt, t) => { l.userData.halo.material.opacity = 0.75 + Math.sin(t * 2 + k) * 0.15; });
    return l;
  });
  // the bottle, bobbing at the end of the pier
  const bottle = makeBottle(); bottle.position.set(-1.2, 0.05, -5.5); bottle.rotation.y = 0.6; scene.add(bottle);
  w.bottle = bottle; w.bottleHome = bottle.position.clone();
  w.tick.push((dt, t) => { if (!w.bottleSailing) { bottle.position.y = 0.05 + Math.sin(t * 1.4) * 0.08; bottle.rotation.z = Math.sin(t * 1.1) * 0.12; } });
  // paper boats drifting
  for (let i = 0; i < 5; i++) {
    const b = makePaperBoat(['#f6ecd6', '#ffd6e6', '#d6f0ff', '#f6ecd6', '#e8ffd6'][i]); const x0 = -20 + r() * 40, z0 = -6 - r() * 30;
    b.position.set(x0, 0.1, z0); b.rotation.y = r() * 6; b.scale.setScalar(1 + r() * 0.5); scene.add(b);
    const sp = 0.2 + r() * 0.25; w.tick.push((dt, t) => { b.position.x += dt * sp; if (b.position.x > 34) b.position.x = -34; b.position.y = 0.1 + Math.sin(t * 1.2 + i) * 0.05; b.rotation.z = Math.sin(t * 1.3 + i) * 0.08; });
  }
  // a rising moon and its path on the water
  const moonDisc = glow(22, 'rgba(255,244,230,1)', 'rgba(255,200,230,0)'); moonDisc.position.set(18, 16, -120); scene.add(moonDisc);
  const moonCore = mesh(new THREE.CircleGeometry(3.2, 40), new THREE.MeshBasicMaterial({ color: '#fff4e6', fog: false }), { noInk: true }); moonCore.position.set(18, 16, -119); scene.add(moonCore);
  for (const [x, y, z, s, seed] of [[-30, 20, -90, 5, 3], [34, 26, -110, 6, 5], [-6, 30, -130, 7, 7]]) {
    const c = makeCloud({ tone: 'cloudPink', seed, puffs: 6 }); c.position.set(x, y, z); c.scale.setScalar(s); scene.add(c);
    w.tick.push((dt) => { c.position.x += dt * 0.2; if (c.position.x > 80) c.position.x = -80; });
  }
  return rig(w, { pos: [-5, 4.2, 22], look: [2, 2.4, -20], sway: [1.6, 0.6], fov: 46 });
}

export const PLACES = { meadow, lagoon };
