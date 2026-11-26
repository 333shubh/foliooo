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

// Folio v1: an easel holding a collage (the old portfolio: a character over a media collage)
function easel() {
  const g = new THREE.Group();
  const leg = (x, z, rx, rz) => { const l = at(cyl(0.022, 0.022, 1.1, 'metal', 5), x, 0.52, z); l.rotation.set(rx, 0, rz); return l; };
  g.add(leg(-0.28, 0.08, 0.1, -0.16), leg(0.28, 0.08, 0.1, 0.16), leg(0, -0.26, -0.32, 0));
  g.add(at(box(0.78, 0.05, 0.12, 'metal'), 0, 0.42, 0.14));
  const panel = new THREE.Group(); panel.position.set(0, 0.78, 0.12); panel.rotation.x = -0.1; g.add(panel);
  panel.add(at(box(0.74, 0.58, 0.04, 'white'), 0, 0, 0));
  [['crystal', -0.18, 0.12, 0.3, 0.22], ['lilac', 0.17, 0.1, 0.3, 0.28], ['lime', -0.14, -0.14, 0.36, 0.18], ['red', 0.2, -0.15, 0.22, 0.16]]
    .forEach(([tone, x, y, w, h]) => panel.add(at(box(w, h, 0.02, tone), x, y, 0.03)));
  return g;
}

// Penumbra: a radar dish listening for what the signatures miss
function radar() {
  const g = new THREE.Group();
  g.add(at(cyl(0.16, 0.24, 0.24, 'metal', 10), 0, 0.12, 0));
  g.add(at(cyl(0.035, 0.035, 0.42, 'metal', 6), 0, 0.42, 0));
  const spin = new THREE.Group(); spin.position.y = 0.66; g.add(spin);     // turns slowly, listening
  const head = new THREE.Group(); head.rotation.x = -0.7; spin.add(head);
  const dish = mesh(new THREE.SphereGeometry(0.42, 20, 10, 0, Math.PI * 2, 0, 1.0), 'white', { side: THREE.DoubleSide });
  dish.rotation.x = Math.PI; head.add(dish);
  head.add(at(cyl(0.012, 0.012, 0.42, 'metal', 4), 0, 0.02, 0), at(mesh(new THREE.IcosahedronGeometry(0.045, 1), 'lime', { rim: 0.2 }), 0, 0.24, 0));
  g.userData.tick = (dt) => { spin.rotation.y += dt * 0.6; };
  return g;
}

// SkinDetect: a magnifying glass on a stand, looking closely
function magnifier() {
  const g = new THREE.Group();
  g.add(at(cyl(0.3, 0.34, 0.08, 'metal', 16), 0, 0.04, 0));
  const arm = at(cyl(0.025, 0.025, 0.7, 'metal', 6), 0.05, 0.42, 0); arm.rotation.z = -0.25; g.add(arm);
  const lens = new THREE.Group(); lens.position.set(0.2, 0.86, 0.02); lens.rotation.set(-0.3, 0, -0.25); g.add(lens);
  const rim = mesh(new THREE.TorusGeometry(0.26, 0.04, 8, 32), 'roof', {}); lens.add(rim);
  const glass = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 28), 'crystal', { t1: 0.2 }); glass.rotation.x = Math.PI / 2; lens.add(glass);
  return g;
}

// Lowkei: a hand mirror standing up (the Mirror you talk to)
function mirror() {
  const g = new THREE.Group();
  g.add(at(box(0.5, 0.08, 0.3, 'lilac'), 0, 0.04, 0));
  g.add(at(cyl(0.04, 0.05, 0.36, 'roof', 8), 0, 0.26, 0));
  const frame = mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 32), 'roof', {}); frame.scale.y = 1.25; g.add(at(frame, 0, 0.82, 0));
  const glass = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 28), 'crystal', { t1: 0.25 }); glass.rotation.x = Math.PI / 2; glass.scale.z = 1.25; g.add(at(glass, 0, 0.82, 0));
  return g;
}

// Prakriva: a potted tulsi plant (Ayurveda)
function plant() {
  const g = new THREE.Group();
  g.add(at(cyl(0.26, 0.2, 0.32, 'sand', 12), 0, 0.16, 0), at(cyl(0.28, 0.28, 0.06, 'mesa', 12), 0, 0.33, 0));
  g.add(at(cyl(0.025, 0.03, 0.4, 'trunk', 6), 0, 0.52, 0));
  [[0, 0.82, 0, 0.24], [-0.18, 0.66, 0.06, 0.17], [0.19, 0.7, -0.04, 0.18], [0.04, 0.68, 0.18, 0.15]]
    .forEach(([x, y, z, r]) => g.add(at(mesh(new THREE.IcosahedronGeometry(r, 0), 'leaf', { flat: 1 }, { flat: 1 }), x, y, z)));
  return g;
}

// Bakes by Mom: a two-tier cake with a cherry
function cake() {
  const g = new THREE.Group();
  g.add(at(cyl(0.44, 0.44, 0.05, 'white', 24), 0, 0.025, 0));
  g.add(at(cyl(0.36, 0.36, 0.3, 'cloudPink', 24), 0, 0.2, 0), at(cyl(0.37, 0.37, 0.05, 'white', 24), 0, 0.36, 0));
  g.add(at(cyl(0.24, 0.24, 0.24, 'lilac', 24), 0, 0.5, 0), at(cyl(0.25, 0.25, 0.04, 'white', 24), 0, 0.63, 0));
  g.add(at(mesh(new THREE.IcosahedronGeometry(0.07, 2), 'red', { rim: 0.2 }), 0, 0.72, 0));
  return g;
}

// Solae: a beach umbrella (swimwear)
function umbrella() {
  const g = new THREE.Group();
  const pole = at(cyl(0.02, 0.02, 1, 'white', 6), 0, 0.5, 0); pole.rotation.z = 0.12; g.add(pole);
  const top = mesh(new THREE.ConeGeometry(0.62, 0.26, 8, 1, true), 'cloudPink', { side: THREE.DoubleSide });
  g.add(at(top, -0.06, 1.0, 0)); top.rotation.z = 0.12;
  g.add(at(box(0.5, 0.04, 0.28, 'crystal'), 0.32, 0.02, 0.2));
  return g;
}

// MealyMoore: two states joined by a transition
function states() {
  const g = new THREE.Group();
  for (const [x, tone] of [[-0.32, 'lilac'], [0.32, 'lime']]) {
    const ring = mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 24), tone, {}); g.add(at(ring, x, 0.5, 0));
    g.add(at(cyl(0.025, 0.025, 0.3, 'metal', 5), x, 0.15, 0));
  }
  g.add(at(box(0.3, 0.04, 0.04, 'white'), 0, 0.5, 0));
  const tip = mesh(new THREE.ConeGeometry(0.06, 0.12, 8), 'white', {}); tip.rotation.z = -Math.PI / 2; g.add(at(tip, 0.13, 0.5, 0));
  return g;
}

export const LANDMARKS = { bridgr: bridge, veil: lighthouse, rsashield: fort, undercurrent: mast, vinyasgen: city, userpersonas: huts, folio: easel,
  penumbra: radar, skindetect: magnifier, lowkei: mirror, prakriva: plant, bakesbymom: cake, solae: umbrella, mealymoore: states };

export function makeLandmark(slug) {
  const make = LANDMARKS[slug];
  if (!make) return null;
  const g = make();
  g.userData.slug = slug;
  g.traverse((o) => { if (o.isMesh) o.userData.slug = slug; });
  return g;
}
