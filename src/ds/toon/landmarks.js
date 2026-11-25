import * as THREE from 'three';
import { toon } from './materials.js';

/* ==========================================================================
   Project landmarks: each project lives on the home planet as a tiny
   building that hints at what it does. Built ~1 unit tall, origin at the
   ground, +y up. userData.slug ties it back to content.js.
   ========================================================================== */

const mesh = (geo, tone, opts, ud = {}) => { const m = new THREE.Mesh(geo, toon(tone, opts)); Object.assign(m.userData, ud); return m; };
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const box = (w, h, d, tone, o) => mesh(new THREE.BoxGeometry(w, h, d), tone, { flat: 1, ...o }, { flat: 1 });
const cyl = (rt, rb, h, tone, seg = 16, o) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), tone, o);
const LIGHT_TONE = { shade: '#f0b43a', base: '#ffd84a', light: '#fff6c2' };

// Bridgr: an arch bridge over a little gap (bridging study and industry)
function bridge() {
  const g = new THREE.Group();
  const arch = mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 24, Math.PI), 'red', {});
  at(arch, 0, 0.02, 0); g.add(arch);
  g.add(at(box(1.15, 0.06, 0.26, 'lilac'), 0, 0.44, 0));
  for (const x of [-0.5, 0.5]) g.add(at(box(0.1, 0.46, 0.26, 'metal'), x, 0.21, 0));
  for (let i = -3; i <= 3; i++) g.add(at(cyl(0.012, 0.012, 0.18, 'metal', 4), i * 0.14, 0.55, 0.12), at(cyl(0.012, 0.012, 0.18, 'metal', 4), i * 0.14, 0.55, -0.12));
  return g;
}

// Veil: a lighthouse whose lamp is hooded (sees the total, hides the homes)
function lighthouse() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) g.add(at(cyl(0.2 - i * 0.025, 0.23 - i * 0.025, 0.24, i % 2 ? 'white' : 'red', 16), 0, 0.12 + i * 0.24, 0));
  g.add(at(cyl(0.17, 0.17, 0.2, LIGHT_TONE, 16, { t1: -1 }), 0, 1.06, 0));
  g.add(at(cyl(0.02, 0.23, 0.22, 'roof', 16), 0, 1.27, 0));
  g.add(at(cyl(0.24, 0.24, 0.04, 'roof', 16), 0, 0.95, 0));
  return g;
}

// RSAShield: a little fort with a shield on the gate
function fort() {
  const g = new THREE.Group();
  g.add(at(box(0.8, 0.42, 0.8, 'sand'), 0, 0.21, 0));
  for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) {
    g.add(at(cyl(0.13, 0.13, 0.62, 'mesa', 10), x, 0.31, z));
    g.add(at(cyl(0.03, 0.15, 0.16, 'roof', 10), x, 0.7, z));
  }
  for (let i = -1; i <= 1; i++) g.add(at(box(0.12, 0.1, 0.06, 'sand'), i * 0.22, 0.47, 0.4));
  const shield = new THREE.Shape(); shield.moveTo(-0.14, 0.16); shield.lineTo(0.14, 0.16); shield.lineTo(0.14, 0); shield.quadraticCurveTo(0.12, -0.14, 0, -0.2); shield.quadraticCurveTo(-0.12, -0.14, -0.14, 0);
  const sh = mesh(new THREE.ExtrudeGeometry(shield, { depth: 0.05, bevelEnabled: false }), 'lime', { rim: 0.2 });
  g.add(at(sh, 0, 0.26, 0.41));
  return g;
}

// Undercurrent: a radio mast that sends one signal a day
function mast() {
  const g = new THREE.Group();
  g.add(at(cyl(0.02, 0.12, 1.3, 'metal', 4, { flat: 1 }), 0, 0.65, 0));
  for (const y of [0.35, 0.7, 1.0]) { const r = mesh(new THREE.TorusGeometry(0.11 - y * 0.06, 0.012, 6, 16), 'metal', {}); r.rotation.x = Math.PI / 2; g.add(at(r, 0, y, 0)); }
  g.add(at(mesh(new THREE.IcosahedronGeometry(0.06, 2), 'red', { rim: 0.3 }), 0, 1.34, 0));
  g.add(at(box(0.32, 0.22, 0.26, 'lilac'), 0.22, 0.11, 0.14));
  // signal rings: animated by the scene
  const waves = new THREE.Group(); waves.position.y = 1.34; g.add(waves);
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.01, 6, 32), new THREE.MeshBasicMaterial({ color: '#7bf583', transparent: true }));
    w.userData.noInk = true; w.userData.phase = i / 3; waves.add(w);
  }
  g.userData.tick = (dt, t) => waves.children.forEach((w) => {
    const k = (t * 0.6 + w.userData.phase) % 1;
    w.scale.setScalar(1 + k * 3); w.material.opacity = 1 - k; w.lookAt(w.getWorldPosition(new THREE.Vector3()).multiplyScalar(2));
  });
  return g;
}

// VinyasGen: a tiny planned city block
function city() {
  const g = new THREE.Group(), tones = ['lilac', 'metal', 'crystal', 'lilac', 'white', 'crystal'];
  const lots = [[-0.3, -0.3, 0.7], [0, -0.3, 0.45], [0.3, -0.3, 0.9], [-0.3, 0.05, 0.4], [0.3, 0.05, 0.55], [-0.05, 0.32, 0.3], [0.3, 0.35, 0.35]];
  lots.forEach(([x, z, h], i) => g.add(at(box(0.22, h, 0.22, tones[i % tones.length]), x, h / 2, z)));
  g.add(at(box(0.9, 0.03, 0.08, 'rock'), 0, 0.015, -0.12), at(box(0.08, 0.03, 0.9, 'rock'), 0.15, 0.015, 0));
  return g;
}

// User Personas: three tiny huts, each a different colour and shape
function huts() {
  const g = new THREE.Group();
  [['lilac', 'roof', -0.32], ['lime', 'red', 0.02], ['crystal', 'mesa', 0.34]].forEach(([wall, roof, x], i) => {
    g.add(at(cyl(0.14, 0.15, 0.26, wall, 12), x, 0.13, i === 1 ? 0.16 : -0.06));
    g.add(at(cyl(0.01, 0.2, 0.22, roof, 12), x, 0.37, i === 1 ? 0.16 : -0.06));
  });
  return g;
}

export const LANDMARKS = { bridgr: bridge, veil: lighthouse, rsashield: fort, undercurrent: mast, vinyasgen: city, userpersonas: huts };

export function makeLandmark(slug) {
  const make = LANDMARKS[slug];
  if (!make) return null;
  const g = make();
  g.userData.slug = slug;
  g.traverse((o) => { if (o.isMesh) o.userData.slug = slug; });
  return g;
}
