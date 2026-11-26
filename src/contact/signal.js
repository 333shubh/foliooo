import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon } from '../ds/toon/materials.js';
import { rng, fbm, noise2, makeRock, makeCloud, makeStars } from '../ds/toon/props.js';

/* ==========================================================================
   SIGNAL: one vertical world for the Contact page.
     y −142 … −20   the deep: a trench, glowing coral, kelp, jellyfish, a whale
     y 0            the surface: a rough night sea
     y 0 … 50       the storm: a relay station on a sea stack, rain, lightning
     y 60 … 150     aurora above the cloud deck
     y 380          orbit: the satellite that catches your message
   Everything is built up front (the Stage assigns render layers once).
   ========================================================================== */

export const STATION = new THREE.Vector3(4, 5.6, -10);     // top of the deck, on the sea stack
export const SAT_Y = 380;
export const TITLE_Y = -118;

const T = {
  wall:   { shade: '#0e0a30', base: '#1b1656', light: '#2f2c86' },
  pillar: { shade: '#1c0f44', base: '#38206e', light: '#6c46b0' },
  coralA: { shade: '#8a1f6e', base: '#e0479f', light: '#ff9ad6' },
  coralB: { shade: '#0f6a74', base: '#20b5b0', light: '#86f3e2' },
  coralC: { shade: '#a8402a', base: '#ff7a4a', light: '#ffc28c' },
  whale:  { shade: '#0e1a48', base: '#1f3478', light: '#4a6cc4' },
  storm:  { shade: '#1a0d3e', base: '#352066', light: '#b465b8' },
  deck:   { shade: '#3e3760', base: '#5d567e', light: '#8b85ad' },
  paint:  { shade: '#9a90bd', base: '#c9c1e3', light: '#e4ddf5' },
  dark:   { shade: '#120a22', base: '#1e1236', light: '#33245a' },
  panel:  { shade: '#1d1a6e', base: '#2f2ab0', light: '#5a55f0' },
  gold:   { shade: '#9c6a2a', base: '#d9a24a', light: '#ffd98a' },
  buoy:   { shade: '#a8203a', base: '#e0394f', light: '#ff7a86' },
};
export const GLOW = { lime: '#7bf583', cyan: '#71f0ff', pink: '#ff7ad9', lilac: '#d28eff', peach: '#ffc58e', white: '#f3eaff' };

const PI = Math.PI;
const noInk = (o) => { o.traverse((c) => { c.userData.noInk = true; }); return o; };
const add = (parent, o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); parent.add(o); return o; };

/* ---------- shared glsl ---------- */
const NOISE = /* glsl */ `
  float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }`;

/* ---------- a soft round glow, for sprites ---------- */
let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.18)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.NoColorSpace;
  return glowTex;
}
export function glowSprite(color, size = 1, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(size); s.userData.noInk = true; return s;
}
const basic = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, fog: false, ...opts });
const additive = (color, opacity = 1) => basic(color, { transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

/* ---------- points with soft glow and per-point colour + size ---------- */
export function glowPoints(count, { drift = 0, fade = 120 } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uDrift: { value: drift }, uFade: { value: fade }, uBoost: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; uniform float uTime, uPx, uDrift, uFade, uBoost; varying vec3 vC; varying float vA;
      void main() {
        vec3 p = position;
        p += uDrift * vec3(sin(uTime * 0.4 + p.y * 0.3 + p.z), cos(uTime * 0.33 + p.x * 0.25), sin(uTime * 0.27 + p.x * 0.2));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        gl_PointSize = min(aSize * uPx * 600.0 / max(d, 0.5), 90.0);
        vA = (1.0 - smoothstep(uFade * 0.35, uFade, d)) * (0.75 + 0.25 * sin(uTime * 2.3 + p.x * 9.0 + p.y * 5.0));
        vC = aColor * uBoost;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); a = a * a * 0.6 + smoothstep(0.35, 0.0, d) * 0.7; gl_FragColor = vec4(vC * a * vA, 1.0); }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.userData.noInk = true;
  return p;
}
const col = new THREE.Color();
const setC = (arr, i, hex, k = 1) => { col.set(hex); arr[i * 3] = col.r * k; arr[i * 3 + 1] = col.g * k; arr[i * 3 + 2] = col.b * k; };

/* =========================================================================
   SKY: storm night → open space; under water it becomes the murk.
   ========================================================================= */
function makeSkyDome() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uAlt: { value: 0 }, uUnder: { value: 1 }, uFog: { value: new THREE.Color('#0b0626') }, uFlash: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uAlt, uUnder, uFlash, uTime; uniform vec3 uFog; varying vec3 vP;
      ${NOISE}
      void main() {
        float h = vP.y;
        // a storm at the end of sunset: indigo overhead, violet, then a hot pink/peach band where the sun went down (−z)
        float sun = pow(max(0.0, dot(normalize(vP.xz + vec2(0.0001)), normalize(vec2(0.35, -1.0)))), 10.0) * smoothstep(0.55, 0.0, vP.y);
        vec3 top = vec3(0.06, 0.03, 0.2), mid = vec3(0.3, 0.12, 0.55);
        vec3 hor = mix(vec3(0.42, 0.17, 0.6), vec3(1.0, 0.36, 0.56), sun);
        vec3 storm = mix(hor, mid, smoothstep(0.0, 0.26, h));
        storm = mix(storm, top, smoothstep(0.26, 0.85, h));
        storm += vec3(1.0, 0.62, 0.38) * sun * smoothstep(0.1, 0.0, abs(h - 0.01)) * 0.9;   // the last light on the horizon
        storm = h < 0.0 ? mix(storm, vec3(0.2, 0.1, 0.35), smoothstep(0.0, -0.2, h)) : storm;
        vec2 q = vP.xz / (abs(vP.y) + 0.3);
        float n = fbm(q * 1.4 + vec2(uTime * 0.015, uTime * 0.006));
        storm *= 0.7 + 0.6 * n;
        storm += vec3(0.85, 0.42, 0.7) * pow(n, 3.0) * sun * 0.45 * smoothstep(0.0, 0.3, h);   // sunset catching the cloud tops
        storm += vec3(0.62, 0.85, 1.0) * uFlash * (0.25 + 0.75 * n) * smoothstep(-0.05, 0.35, h);
        vec3 d = vP * 2.4;
        float nb = fbm(d.xy + d.z * 0.7 + 3.0), nb2 = fbm(d.zy * 1.3 - d.x * 0.5 + 11.0);
        vec3 space = vec3(0.018, 0.01, 0.05)
          + vec3(0.42, 0.14, 0.62) * pow(nb, 3.0) * 1.5
          + vec3(0.75, 0.22, 0.5) * pow(nb2, 4.0) * 1.6
          + vec3(0.15, 0.7, 0.85) * pow(fbm(d.xz * 0.8 + 21.0), 4.0) * 1.5
          + vec3(1.0, 0.7, 0.3) * pow(fbm(d.yx * 1.7 + 31.0), 6.0) * 1.2;
        space += vec3(0.35, 0.28, 0.95) * smoothstep(0.05, -0.35, h) * 0.6;     // the planet's glow below
        vec3 c = mix(storm, space, uAlt);
        c = mix(c, uFog * (0.7 + 0.7 * smoothstep(-0.3, 1.0, h)), uUnder);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), m); s.userData.noInk = true; s.frustumCulled = false;
  return s;
}

/* =========================================================================
   SEA: one surface, two faces. Above: rough banded night water lit by the
   station. Below: a bright rippling ceiling with caustics.
   ========================================================================= */
export const waveAt = (x, z, t) => Math.sin(x * 0.18 + t * 1.1) * 0.5 + Math.sin(z * 0.23 - t * 0.9 + x * 0.07) * 0.45 + Math.sin((x + z) * 0.5 + t * 1.8) * 0.15;
function makeSea() {
  const geo = new THREE.PlaneGeometry(900, 900, 220, 220); geo.rotateX(-PI / 2);
  const m = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uFlash: { value: 0 }, uStation: { value: STATION.clone() }, uRing: { value: -1 } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime, uRing; uniform vec3 uStation; varying vec3 vW; varying float vH;
      float wave(vec2 p) { return sin(p.x * 0.18 + uTime * 1.1) * 0.5 + sin(p.y * 0.23 - uTime * 0.9 + p.x * 0.07) * 0.45 + sin((p.x + p.y) * 0.5 + uTime * 1.8) * 0.15; }
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        float h = wave(w.xz);
        if (uRing > 0.0) { float d = length(w.xz - uStation.xz); h += exp(-pow((d - uRing) * 0.35, 2.0)) * 2.2 * exp(-uRing * 0.012); }
        w.y += h; vH = h; vW = w.xyz;
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime, uFlash; uniform vec3 uStation; varying vec3 vW; varying float vH;
      ${NOISE}
      void main() {
        vec3 c;
        if (gl_FrontFacing) {
          vec3 deep = vec3(0.04, 0.06, 0.2), base = vec3(0.09, 0.15, 0.38), lite = vec3(0.35, 0.5, 0.95);
          float band = sin(vW.z * 0.55 + vH * 2.4 + sin(vW.x * 0.13 + uTime * 0.5) * 1.6);
          c = mix(base, deep, smoothstep(-0.1, -0.7, vH));
          c = mix(c, lite, smoothstep(0.86, 0.9, band) * 0.55);
          c = mix(c, vec3(0.8, 0.74, 1.0), smoothstep(0.7, 1.0, vH) * 0.45);
          vec2 rel = vW.xz - uStation.xz;
          float pool = exp(-dot(rel, rel) / 160.0);
          vec2 toCam = normalize(cameraPosition.xz - uStation.xz);
          float along = dot(rel, toCam), side = abs(rel.x * toCam.y - rel.y * toCam.x);
          float column = exp(-side * side / 6.0) * smoothstep(-3.0, 3.0, along) * exp(-max(along, 0.0) / 34.0);
          float sparkle = step(0.8, hsh(floor(vW.xz * 1.6 + floor(uTime * 6.0) * 0.37))) * step(0.3, band);
          vec3 vv = normalize(vW - cameraPosition);
          float sunR = pow(max(0.0, dot(normalize(vv.xz + vec2(0.0001)), normalize(vec2(0.35, -1.0)))), 10.0), graze = pow(1.0 - abs(vv.y), 5.0);
          c = mix(c, mix(vec3(0.3, 0.14, 0.5), vec3(1.0, 0.45, 0.55), sunR), graze * 0.5);          // the sky in the water
          c += vec3(1.0, 0.6, 0.45) * sunR * graze * step(0.75, band) * 0.6;
          c += vec3(1.0, 0.78, 0.86) * (pool * 0.32 + column * (0.22 + 0.7 * sparkle));
          c += vec3(0.6, 0.55, 1.0) * uFlash * 0.35;
        } else {
          vec3 v = normalize(vW - cameraPosition);
          float snell = smoothstep(0.5, 0.9, v.y);
          vec2 p = vW.xz * 0.3;
          float n = vn(p + uTime * 0.35) + vn(p * 1.7 - uTime * 0.27);
          float cl = smoothstep(0.82, 1.0, 1.0 - abs(n - 1.0));
          c = mix(vec3(0.12, 0.32, 0.62), vec3(0.62, 0.95, 1.0), snell) + cl * mix(vec3(0.5, 0.95, 1.0), vec3(1.0, 0.6, 0.9), vn(p * 0.3)) * (0.4 + snell);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  const s = new THREE.Mesh(geo, m); s.userData.noInk = true; s.frustumCulled = false;
  return s;
}

/* =========================================================================
   THE DEEP
   ========================================================================= */
const floorH = (x, z) => {
  const ax = Math.abs(x - 2);
  const wall = THREE.MathUtils.smoothstep(ax, 15, 36) * (80 + fbm(x * 0.05, z * 0.05 + 3, 4) * 48);
  const back = THREE.MathUtils.smoothstep(-z, 80, 135) * (55 + fbm(x * 0.04 + 7, z * 0.03, 3) * 40);
  return -142 + fbm(x * 0.07 + 1, z * 0.07, 4) * 6 + Math.max(wall, back);
};
function makeTrench() {
  const geo = new THREE.PlaneGeometry(220, 240, 200, 200); geo.rotateX(-PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i) - 70;
    let y = floorH(x, z);
    const f = y / 7, fl = Math.floor(f); y = (fl + THREE.MathUtils.smoothstep(Math.min(1, (f - fl) * 3), 0, 1)) * 7;   // ledges
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const cols = new Float32Array(p.count * 3), c = new THREE.Color(), a = new THREE.Color();
  const strata = ['#1b0f4e', '#3a1670', '#5e1f7e', '#163f74', '#1e6a82', '#2a1260'].map((h) => new THREE.Color(h));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const band = (y + 142) / 9 + fbm(x * 0.05, z * 0.05, 2) * 3;
    const k = Math.floor(band) % strata.length, f = band - Math.floor(band);
    c.copy(strata[(k + strata.length) % strata.length]).lerp(strata[(k + 1 + strata.length) % strata.length], THREE.MathUtils.smoothstep(f, 0.75, 1));
    a.set('#ff5fb0'); c.lerp(a, Math.max(0, noise2(x * 0.08 + 9, z * 0.08) - 0.78) * 1.6);   // pink mineral seams
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, toon(T.wall, { t1: 0.2, t2: 0.72, vertexColors: true }));
  return m;
}

function makePillar() {
  let geo = new THREE.CylinderGeometry(5.4, 9, 150, 20, 60);
  geo.translate(0, -70, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), r = Math.hypot(x, z);
    if (r < 0.01) { if (y > 0) p.setY(i, 5.3); continue; }
    const k = 1 + (noise2(a * 1.8 + 4, y * 0.07) - 0.5) * 0.55 + Math.floor(noise2(a * 0.9, y * 0.03 + 9) * 4) * 0.05;
    p.setXYZ(i, Math.cos(a) * r * k, y > 4.9 ? 5.3 : y, Math.sin(a) * r * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, toon(T.pillar, { flat: 1, t1: 0.05, t2: 0.62 }));
  m.userData.flat = 1;
  m.position.set(STATION.x, 0, STATION.z);
  return m;
}

// branching coral: one merged mesh of stalks + glowing tips (returned separately)
function makeCoral(seed, scale = 1, tone = T.coralA) {
  const r = rng(seed), parts = [], tips = [];
  const branch = (base, dir, len, rad, depth) => {
    const g = new THREE.CylinderGeometry(rad * 0.6, rad, len, 6, 1);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.applyQuaternion(q); g.translate(base.x, base.y, base.z);
    parts.push(g);
    const end = base.clone().addScaledVector(dir, len);
    if (depth <= 0) { tips.push(end); return; }
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const d = dir.clone().add(new THREE.Vector3((r() - 0.5) * 1.3, 0.25 + r() * 0.3, (r() - 0.5) * 1.3)).normalize();
      branch(end, d, len * (0.6 + r() * 0.2), rad * 0.62, depth - 1);
    }
  };
  const stems = 3 + Math.floor(r() * 3);
  for (let i = 0; i < stems; i++) branch(new THREE.Vector3((r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8), new THREE.Vector3((r() - 0.5) * 0.8, 1, (r() - 0.5) * 0.8).normalize(), 1.4 + r(), 0.22, 2);
  const g = mergeGeometries(parts);
  const m = new THREE.Mesh(g, toon(tone, { flat: 1, t1: 0.0, t2: 0.55 }));
  m.userData.flat = 1; m.scale.setScalar(scale);
  return { mesh: m, tips: tips.map((t) => t.multiplyScalar(scale)) };
}

function makeKelp(count = 34, seed = 5) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < count; i++) {
    const side = r() > 0.5 ? 1 : -1;
    const x = 2 + side * (17 + r() * 18), z = -45 + r() * 38;
    const y0 = floorH(x, z) - 1, len = Math.min(26 + r() * 40, -9 - y0);
    if (len < 8) continue;
    const g = new THREE.PlaneGeometry(0.9 + r() * 0.8, len, 1, 24);
    g.translate(0, len / 2, 0); g.rotateY(r() * PI);
    const n = g.attributes.position.count;
    const ph = new Float32Array(n).fill(r() * 6.28), hh = new Float32Array(n);
    for (let k = 0; k < n; k++) hh[k] = g.attributes.position.getY(k) / len;
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1)); g.setAttribute('aH', new THREE.BufferAttribute(hh, 1));
    g.translate(x, y0, z);
    parts.push(g);
  }
  const geo = mergeGeometries(parts);
  const m = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute float aPhase, aH; uniform float uTime; varying float vH;
      void main() {
        vec3 p = position; float k = pow(aH, 1.4);
        p.x += sin(uTime * 0.7 + aPhase + aH * 4.0) * k * 3.2;
        p.z += cos(uTime * 0.5 + aPhase * 1.3 + aH * 3.0) * k * 1.6;
        vH = aH;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      varying float vH;
      void main() {
        vec3 c = mix(vec3(0.03, 0.1, 0.16), vec3(0.1, 0.5, 0.42), smoothstep(0.0, 0.85, vH));
        c = mix(c, vec3(0.1, 0.3, 0.27) * 0.8, step(0.5, fract(vH * 14.0)) * 0.35);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
        gl_FragColor.rgb += vec3(0.48, 0.96, 0.52) * smoothstep(0.94, 1.0, vH) * 0.35;
      }`,
  });
  const mesh = new THREE.Mesh(geo, m); mesh.userData.noInk = true; mesh.frustumCulled = false;
  return mesh;
}

function jellyMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uGlow: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vN, vV; varying float vY; varying float vD;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; vY = position.y; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uGlow, uTime; varying vec3 vN, vV; varying float vY, vD;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = 0.12 + pow(f, 2.2) * 0.9 + smoothstep(0.05, 0.0, vY) * 0.6;
        a *= 0.85 + 0.15 * sin(vY * 30.0 - uTime * 3.0);
        a *= uGlow * (1.0 - smoothstep(30.0, 95.0, vD));
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });
}
function makeJelly(color, size, seed) {
  const r = rng(seed), g = new THREE.Group();
  const mat = jellyMaterial(color);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, PI * 2, 0, PI * 0.52), mat);
  g.add(bell);
  const core = glowSprite(color, 2.2, 0.55); core.position.y = 0.3; g.add(core);
  const N = 9, S = 14;
  const pos = new Float32Array(N * S * 2 * 3);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  lines.frustumCulled = false; g.add(lines);
  const roots = Array.from({ length: N }, (_, i) => { const a = (i / N) * PI * 2; return [Math.cos(a) * 0.8, Math.sin(a) * 0.8, 2.2 + r() * 2.6, r() * 6]; });
  g.scale.setScalar(size);
  noInk(g);
  const tick = (t, glow) => {
    const s = Math.sin(t * 1.9 + seed);
    bell.scale.set(1 + 0.09 * s, 1 - 0.14 * s, 1 + 0.09 * s);
    mat.uniforms.uGlow.value = glow; mat.uniforms.uTime.value = t;
    core.material.opacity = 0.35 + 0.4 * glow;
    let k = 0;
    for (const [x, z, len, ph] of roots) {
      let px = x, py = 0, pz = z;
      for (let j = 0; j < S; j++) {
        const u = (j + 1) / S;
        const nx = x * (1 - u * 0.4) + Math.sin(t * 1.3 + ph + u * 5) * 0.35 * u, ny = -u * len, nz = z * (1 - u * 0.4) + Math.cos(t * 1.1 + ph + u * 4) * 0.35 * u;
        pos[k++] = px; pos[k++] = py; pos[k++] = pz; pos[k++] = nx; pos[k++] = ny; pos[k++] = nz;
        px = nx; py = ny; pz = nz;
      }
    }
    lg.attributes.position.needsUpdate = true;
  };
  return { group: g, tick };
}

// a whale: a tapered body, flukes, pectoral fins, and a row of glowing spots
function makeWhale() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const geo = new THREE.SphereGeometry(1, 40, 24), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const taper = x < 0 ? 1 + x * 0.78 : 1 - x * x * 0.2;
    p.setXYZ(i, x * 13, y * 3.1 * taper * (y < 0 ? 0.85 : 1), z * 3.5 * taper);
  }
  geo.computeVertexNormals();
  const mat = toon(T.whale, { rim: 0.14, t1: 0.0, t2: 0.6 });
  body.add(new THREE.Mesh(geo, mat));
  const tail = new THREE.Group(); tail.position.x = -12.2; body.add(tail);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.bezierCurveTo(-1.5, 1.2, -4.2, 3.4, -5.2, 4.6); shape.bezierCurveTo(-3.6, 3.2, -2.6, 1.4, -2.2, 0);
  shape.bezierCurveTo(-2.6, -1.4, -3.6, -3.2, -5.2, -4.6); shape.bezierCurveTo(-4.2, -3.4, -1.5, -1.2, 0, 0);
  const fl = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false }); fl.translate(0, 0, -0.17); fl.rotateX(PI / 2);
  tail.add(new THREE.Mesh(fl, mat));
  for (const s of [1, -1]) {
    const fin = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), mat);
    fin.scale.set(2.6, 0.18, 0.9); fin.position.set(5.5, -1.7, s * 2.9); fin.rotation.set(s * 0.5, s * 0.5, -0.4); body.add(fin);
  }
  // bioluminescent spots shine through the murk (no fog)
  const spots = []; const r = rng(42);
  for (let i = 0; i < 46; i++) {
    const u = r(), x = 10 - u * 21, side = r() > 0.5 ? 1 : -1;
    const taper = x < 0 ? 1 + (x / 13) * 0.78 : 1 - (x / 13) ** 2 * 0.2;
    const ang = (0.15 + r() * 0.75) * side;
    const sg = new THREE.SphereGeometry(0.11 + r() * 0.12, 6, 4);
    sg.translate(x, Math.sin(ang * 1.2) * 0.9 * taper - 0.3, Math.cos(ang) * 3.55 * taper * side);
    spots.push(sg);
  }
  const sp = new THREE.Mesh(mergeGeometries(spots), basic(GLOW.cyan)); sp.userData.noInk = true; body.add(sp);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), basic(GLOW.lilac)); eye.position.set(9.2, -0.4, 2.4); eye.userData.noInk = true; body.add(eye);
  g.userData.tail = tail; g.userData.body = body; g.userData.spots = sp;
  return g;
}

/* =========================================================================
   THE STORM STATION
   ========================================================================= */
function makeDish() {
  const g = new THREE.Group();
  const metal = toon(T.deck, { t1: 0.0, t2: 0.6 }), paint = toon(T.paint, { t1: -0.1, t2: 0.55, rim: 0.1, side: THREE.DoubleSide });
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 2.4, 12), metal), 0, 1.2, 0);
  const yaw = add(g, new THREE.Group(), 0, 2.5, 0);
  for (const s of [1, -1]) add(yaw, new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.6), metal), s * 1.3, 0.6, 0);
  add(yaw, new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.35, 0.8), metal), 0, -0.1, 0);
  const pitch = add(yaw, new THREE.Group(), 0, 1.1, 0);
  const f = 2.3, R = 3.8, pts = [];
  for (let i = 0; i <= 16; i++) { const rr = (i / 16) * R; pts.push(new THREE.Vector2(Math.max(rr, 0.001), (rr * rr) / (4 * f))); }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), paint); pitch.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.09, 6, 48), metal); rim.rotation.x = PI / 2; rim.position.y = (R * R) / (4 * f); pitch.add(rim);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 0.6, 12), metal); back.position.y = -0.1; pitch.add(back);
  const focus = new THREE.Vector3(0, f, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2, start = new THREE.Vector3(Math.cos(a) * R * 0.92, (R * R * 0.85) / (4 * f), Math.sin(a) * R * 0.92);
    const len = start.distanceTo(focus);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 5), metal);
    strut.position.copy(start).lerp(focus, 0.5); strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), focus.clone().sub(start).normalize());
    pitch.add(strut);
  }
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 0.7, 10), metal); horn.position.copy(focus); pitch.add(horn);
  const focusPt = new THREE.Object3D(); focusPt.position.copy(focus).y += 0.4; pitch.add(focusPt);
  const charge = glowSprite(GLOW.lime, 0.001, 1); focusPt.add(charge);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), basic('#e9ffe0')); core.scale.setScalar(0.001); core.userData.noInk = true; focusPt.add(core);
  return { group: g, yaw, pitch, focus: focusPt, charge, core };
}

function makeMast(h = 16) {
  const g = new THREE.Group(), metal = toon(T.deck, { t1: 0, t2: 0.6 });
  const legs = [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]];
  for (const [x, z] of legs) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 5), metal);
    leg.position.set(x * 0.6, h / 2, z * 0.6); leg.rotation.set(-z * 0.04, 0, x * 0.04); g.add(leg);
  }
  const pts = [];
  for (let y = 0; y < h - 1; y += 1.4) {
    const s0 = 0.36 * (1 - (y / h) * 0.55), s1 = 0.36 * (1 - ((y + 1.4) / h) * 0.55);
    pts.push(new THREE.Vector3(-s0, y, -s0), new THREE.Vector3(s1, y + 1.4, -s1), new THREE.Vector3(s0, y, s0), new THREE.Vector3(-s1, y + 1.4, s1));
    pts.push(new THREE.Vector3(-s0, y, s0), new THREE.Vector3(s1, y + 1.4, s1), new THREE.Vector3(s0, y, -s0), new THREE.Vector3(-s1, y + 1.4, -s1));
  }
  const lat = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#8b85ad', fog: true }));
  lat.userData.noInk = true; g.add(lat);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3, 4), metal); tip.position.y = h + 1.5; g.add(tip);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), basic(GLOW.pink)); lamp.position.y = h + 3.1; lamp.userData.noInk = true; g.add(lamp);
  const halo = glowSprite(GLOW.pink, 4); halo.position.y = h + 3.1; g.add(halo);
  const lamp2 = glowSprite(GLOW.pink, 2.2); lamp2.position.y = h * 0.55; g.add(lamp2);
  g.userData.lamps = [halo, lamp2]; g.userData.bulb = lamp;
  return g;
}

function coneBeam(color, len = 14, r = 4.5) {
  const geo = new THREE.ConeGeometry(r, len, 24, 1, true); geo.translate(0, -len / 2, 0);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uAmp: { value: 1 }, uLen: { value: len } },
    vertexShader: /* glsl */ `varying float vY; varying vec3 vN, vV; uniform float uLen; void main(){ vY = -position.y / uLen; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uAmp; varying float vY; varying vec3 vN, vV;
      void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(1.0 - vY, 1.6) * pow(f, 1.5) * 0.4 * uAmp; gl_FragColor = vec4(uColor * a, 1.0); }`,
  });
  const c = new THREE.Mesh(geo, m); c.userData.noInk = true; return c;
}

function makeStation() {
  const g = new THREE.Group(); g.position.copy(STATION);
  const metal = toon(T.deck, { t1: 0.0, t2: 0.6 }), paint = toon(T.paint, { t1: -0.1, t2: 0.55, rim: 0.08 }), dark = toon(T.dark);
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 0.7, 40), metal), 0, -0.35, 0);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * PI * 2;
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 4), metal), Math.cos(a) * 7, 0.55, Math.sin(a) * 7);
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(7, 0.06, 4, 64), metal); rail.rotation.x = PI / 2; rail.position.y = 1.1; g.add(rail);
  // the hut
  const hut = add(g, new THREE.Group(), -2.8, 0, -2.2);
  add(hut, new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.2, 3.6), paint), 0, 1.6, 0);
  add(hut, new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 4), dark), 0, 3.35, 0);
  const windows = [];
  for (const x of [-1.4, 0, 1.4]) {
    const w = add(hut, new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1), basic(GLOW.peach)), x, 1.9, 1.81); w.userData.noInk = true; windows.push(w);
  }
  const winGlow = glowSprite(GLOW.peach, 7, 0.35); winGlow.position.set(0, 1.9, 2.6); hut.add(winGlow);
  const status = add(hut, new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), basic(GLOW.lime)), 2.05, 2.7, 1.82); status.userData.noInk = true;
  const statusGlow = glowSprite(GLOW.lime, 2.6); statusGlow.position.copy(status.position); hut.add(statusGlow);
  // the small rooftop mast + the tall lattice mast
  const tall = makeMast(17); tall.position.set(-5.2, 0, 2.6); g.add(tall);
  const search = new THREE.Group(); search.position.set(-5.2, 15.2, 2.6); g.add(search);
  const sb = searchBeam('#fff1d6', 150, 16); sb.rotation.z = Math.PI / 2 - 0.13; search.add(sb);       // points out along +x, tipped down a touch
  const sbLamp = glowSprite('#fff4e0', 5); search.add(sbLamp);
  const small = makeMast(5); small.position.set(-1.6, 3.5, -3.2); g.add(small);
  // the dish
  const dish = makeDish(); dish.group.position.set(2.6, 0, 1.4); dish.group.scale.setScalar(1.15); g.add(dish.group);
  // deck lamps + floodlights onto the sea
  const deckLamps = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2 + 0.2;
    const l = glowSprite(i % 2 ? GLOW.lime : GLOW.lilac, 1.4, 0.9); l.position.set(Math.cos(a) * 7, 1.25, Math.sin(a) * 7); g.add(l); deckLamps.push(l);
  }
  const floods = [];
  for (const [x, z, ry] of [[5.5, 4, 0.7], [-6, 3.2, -0.6]]) {
    const head = add(g, new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), dark), x, 2.1, z);
    const cone = coneBeam('#ffd7e6', 16, 6); cone.position.set(x, 2.1, z); cone.rotation.set(0.85, ry, 0); g.add(cone);
    const glow = glowSprite('#efe6ff', 3.5); glow.position.set(x, 2.1, z + 0.3); g.add(glow);
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2, 4), metal), x, 1, z);
    floods.push(cone); void head;
  }
  return { group: g, dish, tall, small, deckLamps, floods, windows, winGlow, status, statusGlow, search, searchBeam: sb };
}

function makeBuoy(color) {
  const g = new THREE.Group();
  const red = toon(T.buoy, { t1: -0.05, t2: 0.55 }), paint = toon(T.paint), metal = toon(T.deck);
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 1.1, 16), red), 0, 0.1, 0);
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.1, 0.5, 16), paint), 0, 0.85, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + 0.4;
    const leg = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), metal), Math.cos(a) * 0.5, 2.1, Math.sin(a) * 0.5);
    leg.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18);
  }
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 10), metal), 0, 3.2, 0);
  const bulb = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), basic(color)), 0, 3.5, 0); bulb.userData.noInk = true;
  const halo = glowSprite(color, 5); halo.position.y = 3.5; g.add(halo);
  const pool = glowSprite(color, 9, 0.25); pool.position.y = 0.4; g.add(pool);
  // a pillar of light rising from the lamp, and rings of light spreading on the water
  const pg = new THREE.CylinderGeometry(0.18, 0.7, 16, 16, 1, true); pg.translate(0, 8, 0);
  const pillar = new THREE.Mesh(pg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uAmp: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uAmp, uTime; varying vec2 vUv; varying vec3 vN, vV;
      void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float rise = 0.75 + 0.25 * sin(vUv.y * 22.0 - uTime * 4.0);
        float a = pow(1.0 - vUv.y, 1.8) * pow(f, 1.4) * rise * 0.75 * uAmp; gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.25) * a, 1.0); }`,
  }));
  pillar.position.y = 3.5; pillar.userData.noInk = true; g.add(pillar);
  const rings = [0, 1, 2].map(() => { const rg = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })); rg.rotation.x = -Math.PI / 2; rg.position.y = 0.3; rg.userData.noInk = true; g.add(rg); return rg; });
  g.userData = { bulb, halo, pool, pillar, rings, top: new THREE.Vector3(0, 8.5, 0) };
  return g;
}

function makeRain(count = 2600) {
  const pos = new Float32Array(count * 6), seed = new Float32Array(count * 2 * 3), end = new Float32Array(count * 2);
  const r = rng(77);
  for (let i = 0; i < count; i++) {
    const x = -60 + r() * 120, y = r() * 70, z = -70 + r() * 110, s = 0.7 + r() * 0.6;
    for (let k = 0; k < 2; k++) {
      const j = i * 2 + k;
      pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z;
      seed[j * 3] = s; seed[j * 3 + 1] = r(); seed[j * 3 + 2] = 0; end[j] = k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uAmp: { value: 1 }, uCam: { value: new THREE.Vector3() } },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed; attribute float aEnd; uniform float uTime; uniform vec3 uCam; varying float vA; varying float vD;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * 34.0 * aSeed.x, 70.0) - 2.0;
        p.x = uCam.x - 60.0 + mod(position.x - uCam.x + 60.0, 120.0);
        p.z = uCam.z - 80.0 + mod(position.z - uCam.z + 80.0, 110.0);
        p += aEnd * vec3(-0.25, -1.3, 0.1) * aSeed.x;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vD = -mv.z;
        vA = (0.25 + 0.75 * aEnd) * (1.0 - smoothstep(20.0, 75.0, vD)) * step(0.0, p.y);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `uniform float uAmp; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.72, 0.68, 1.0) * vA * 0.55 * uAmp, 1.0); }`,
  });
  const l = new THREE.LineSegments(g, m); l.frustumCulled = false; l.userData.noInk = true;
  return l;
}

function makeAurora({ z = -240, y = 70, w = 420, h = 110, seed = 0, bend = 50 }) {
  const geo = new THREE.PlaneGeometry(w, h, 160, 1);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: {
      uTime: { value: 0 }, uAmp: { value: 1 }, uSeed: { value: seed }, uBend: { value: bend },
      uA: { value: new THREE.Color(GLOW.lime) }, uB: { value: new THREE.Color('#3ad6b0') }, uC: { value: new THREE.Color('#b25cff') },
    },
    vertexShader: /* glsl */ `uniform float uTime, uSeed, uBend; varying vec2 vUv;
      void main(){ vUv = uv; vec3 p = position;
        p.z += sin(p.x * 0.012 + uTime * 0.12 + uSeed) * uBend + sin(p.x * 0.031 - uTime * 0.2) * uBend * 0.3;
        p.y += sin(p.x * 0.02 + uTime * 0.18 + uSeed * 2.0) * 6.0 * uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime, uAmp, uSeed; uniform vec3 uA, uB, uC; varying vec2 vUv;
      ${NOISE}
      void main(){
        float n = vn(vec2(vUv.x * 9.0 + uTime * 0.12 + uSeed, uTime * 0.08));
        float rays = pow(vn(vec2(vUv.x * 160.0 + uTime * 0.9 + uSeed * 7.0, vUv.y * 0.6)), 2.5);
        float fold = 0.5 + 0.5 * sin(vUv.x * 26.0 + uTime * 0.35 + n * 5.0);
        float base = smoothstep(0.0, 0.08, vUv.y) * pow(1.0 - vUv.y, 1.3);
        float a = base * (0.3 + 0.7 * fold) * (0.45 + rays * 1.4) * (0.4 + n) * uAmp;
        a *= smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        vec3 c = mix(uA, uB, smoothstep(0.04, 0.35, vUv.y)); c = mix(c, uC, smoothstep(0.35, 0.95, vUv.y));
        gl_FragColor = vec4(c * a * 0.9, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(STATION.x, y + h / 2, z); mesh.userData.noInk = true; mesh.frustumCulled = false;
  return mesh;
}

function makeBolt(r) {
  const pts = [], from = new THREE.Vector3((r() - 0.5) * 8, 40, 0);
  let p = from.clone();
  while (p.y > 0) { const n = p.clone().add(new THREE.Vector3((r() - 0.5) * 5, -2 - r() * 3, (r() - 0.5) * 3)); pts.push(p, n); if (r() < 0.18) { let b = n.clone(); for (let k = 0; k < 4; k++) { const bn = b.clone().add(new THREE.Vector3((r() - 0.5) * 6, -1.5 - r() * 2, (r() - 0.5) * 2)); pts.push(b, bn); b = bn; } } p = n; }
  return pts;
}

/* =========================================================================
   ORBIT
   ========================================================================= */
function makeSatellite() {
  const g = new THREE.Group(), metal = toon(T.deck), gold = toon(T.gold, { flat: 1 }), panel = toon(T.panel, { flat: 1, t1: -0.2, t2: 0.4 });
  add(g, new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 2.4), gold), 0, 0, 0).userData.flat = 1;
  for (const s of [1, -1]) {
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 4), metal), s * 2.4, 0, 0).rotation.z = PI / 2;
    const pn = add(g, new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 2.6), panel), s * 7, 0, 0); pn.userData.flat = 1;
    for (let i = 1; i < 5; i++) { const bar = add(g, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 2.62), metal), s * (3.5 + i * 1.4), 0, 0); void bar; }
  }
  const pts = []; for (let i = 0; i <= 10; i++) { const rr = (i / 10) * 1.6; pts.push(new THREE.Vector2(Math.max(0.001, rr), -(rr * rr) / 3)); }
  const d = add(g, new THREE.Mesh(new THREE.LatheGeometry(pts, 24), toon(T.paint, { side: THREE.DoubleSide })), 0, -2.2, 0);
  void d;
  const lamp = glowSprite(GLOW.lime, 3); lamp.position.set(0, 1.9, 1.3); g.add(lamp);
  const flare = glowSprite(GLOW.lime, 0.001); flare.position.set(0, -2.6, 0); g.add(flare);
  g.userData = { lamp, flare };
  g.position.set(STATION.x, SAT_Y, STATION.z);
  return g;
}

function beamMaterial(core, edge, k = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uAmp: { value: 0 }, uCore: { value: new THREE.Color(core) }, uEdge: { value: new THREE.Color(edge) }, uK: { value: k } },
    vertexShader: /* glsl */ `varying vec3 vN, vV; varying vec2 vUv; varying float vWY; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWY = w.y; vec4 mv = viewMatrix * w; vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform float uTime, uAmp, uK; uniform vec3 uCore, uEdge; varying vec3 vN, vV; varying vec2 vUv; varying float vWY;
      ${NOISE}
      void main(){
        float f = abs(dot(normalize(vN), normalize(vV)));
        float streak = vn(vec2(vUv.x * 18.0, vWY * 0.08 - uTime * 9.0));
        float pulse = 0.7 + 0.3 * sin(vWY * 0.25 - uTime * 30.0);
        vec3 c = mix(uEdge, uCore, pow(f, 3.0));
        float a = pow(f, 1.2 * uK) * (0.6 + streak * 0.8) * pulse * uAmp;
        gl_FragColor = vec4(c * a, 1.0);
      }`,
  });
}

function makeMeteors(n = 18) {
  const pos = new Float32Array(n * 6), colr = new Float32Array(n * 6);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  l.frustumCulled = false; l.userData.noInk = true;
  const r = rng(91), M = Array.from({ length: n }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: -r() * 4, len: 0 }));
  const spawn = (m, cam) => {
    const az = r() * PI * 2, el = 0.2 + r() * 0.9, d = 160 + r() * 140;
    m.p.set(cam.x + Math.cos(az) * Math.cos(el) * d, cam.y + Math.sin(el) * d, cam.z + Math.sin(az) * Math.cos(el) * d);
    m.v.set((r() - 0.5), -0.4 - r() * 0.5, (r() - 0.5)).normalize().multiplyScalar(90 + r() * 90);
    m.life = 0.6 + r() * 0.9; m.len = 0.08 + r() * 0.08;
  };
  const tint = [new THREE.Color(GLOW.white), new THREE.Color(GLOW.lime), new THREE.Color(GLOW.pink), new THREE.Color(GLOW.cyan)];
  const tick = (dt, cam, amp) => {
    M.forEach((m, i) => {
      m.life -= dt;
      if (m.life <= 0) { if (amp > 0.01 && r() < dt * 3) spawn(m, cam); else { pos.fill(0, i * 6, i * 6 + 6); return; } }
      m.p.addScaledVector(m.v, dt);
      const tail = m.p.clone().addScaledVector(m.v, -m.len);
      pos.set([m.p.x, m.p.y, m.p.z, tail.x, tail.y, tail.z], i * 6);
      const c = tint[i % 4], k = Math.min(1, m.life * 2) * amp;
      colr.set([c.r * k, c.g * k, c.b * k, 0, 0, 0], i * 6);
    });
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
  };
  return { lines: l, tick };
}

/* =========================================================================
   The plankton title: points that swarm into words, scattered by the cursor.
   ========================================================================= */
export function sampleText(text, { width = 28, font = '600 220px "Inter Tight", sans-serif', step = 4 } = {}) {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 340;
  const g = c.getContext('2d');
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
  g.fillText(text, c.width / 2, c.height / 2);
  const tw = g.measureText(text).width, k = width / tw;
  const d = g.getImageData(0, 0, c.width, c.height).data, out = [];
  for (let y = 0; y < c.height; y += step) for (let x = 0; x < c.width; x += step) {
    if (d[(y * c.width + x) * 4 + 3] > 140) out.push([(x - c.width / 2 + (Math.random() - 0.5) * step) * k, -(y - c.height / 2 + (Math.random() - 0.5) * step) * k]);
  }
  return out;
}

/* ---------- a school of glowing fish (steered as a flock round a moving lure) ---------- */
function makeSchool(n, colors, seed) {
  const geo = new THREE.ConeGeometry(0.16, 0.75, 5); geo.rotateX(Math.PI / 2);
  const tail = new THREE.ConeGeometry(0.12, 0.3, 3); tail.rotateX(-Math.PI / 2); tail.translate(0, 0, -0.42);
  const g = mergeGeometries([geo.toNonIndexed(), tail.toNonIndexed()]);
  const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), n);
  m.userData.noInk = true; m.frustumCulled = false;
  const r = rng(seed), c = new THREE.Color();
  const fish = Array.from({ length: n }, (_, i) => {
    m.setColorAt(i, c.set(colors[i % colors.length]).multiplyScalar(0.55 + r() * 0.5));
    return { p: new THREE.Vector3((r() - 0.5) * 10, (r() - 0.5) * 6, (r() - 0.5) * 10), v: new THREE.Vector3(r() - 0.5, 0, r() - 0.5), o: new THREE.Vector3((r() - 0.5) * 7, (r() - 0.5) * 3.5, (r() - 0.5) * 7), ph: r() * 6 };
  });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), F = new THREE.Vector3(0, 0, 1), S1 = new THREE.Vector3(1, 1, 1), tgt = new THREE.Vector3(), d = new THREE.Vector3();
  const tick = (dt, t, lure) => {
    fish.forEach((f, i) => {
      tgt.copy(lure).add(d.copy(f.o).applyAxisAngle(F.set(0, 1, 0), t * 0.4 + f.ph * 0.2));
      d.subVectors(tgt, f.p);
      f.v.addScaledVector(d, dt * 1.6).multiplyScalar(Math.exp(-dt * 0.9));
      const sp = f.v.length(); if (sp > 9) f.v.multiplyScalar(9 / sp);
      f.p.addScaledVector(f.v, dt);
      Q.setFromUnitVectors(F.set(0, 0, 1), d.copy(f.v).normalize());
      S1.setScalar(1 + Math.sin(t * 9 + f.ph) * 0.06);
      M.compose(f.p, Q, S1); m.setMatrixAt(i, M);
    });
    m.instanceMatrix.needsUpdate = true;
  };
  return { mesh: m, tick };
}

/* ---------- a giant clam on a ledge, holding a glowing pearl (the notes pin to these) ---------- */
function makeClam(pearlColor, seed) {
  const g = new THREE.Group();
  const ledge = makeRock({ seed, tone: T.pillar, squash: [2.6, 0.7, 1.8] }); ledge.scale.setScalar(2.2); ledge.position.y = -1.6; g.add(ledge);
  const shellT = { shade: '#7a2f6e', base: '#d0609a', light: '#ffb3d6' };
  const mk = () => {
    const geo = new THREE.SphereGeometry(1.6, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x); p.setY(i, p.getY(i) * 0.55 + Math.max(0, Math.cos(a * 9)) * 0.08 * (1 - p.getY(i) / 1.6)); }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, toon(shellT, { t1: -0.1, t2: 0.55, side: THREE.DoubleSide, rim: 0.1 }));
  };
  const bottom = mk(); bottom.rotation.x = Math.PI; g.add(bottom);
  const hinge = new THREE.Group(); hinge.position.set(0, 0, -1.55); g.add(hinge);
  const top = mk(); top.position.set(0, 0, 1.55); hinge.add(top); hinge.rotation.x = -0.95;
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), basic(pearlColor)); pearl.position.set(0, 0.35, 0.1); pearl.userData.noInk = true; g.add(pearl);
  const halo = glowSprite(pearlColor, 6, 0.9); halo.position.copy(pearl.position); g.add(halo);
  g.userData = { pearl, halo, hinge };
  return g;
}

/* ---------- a searchlight beam: a long soft cone ---------- */
function searchBeam(color, len, r) {
  const c = coneBeam(color, len, r);
  c.material.uniforms.uAmp.value = 0.55;
  return c;
}

/* =========================================================================
   BUILD
   ========================================================================= */
export function buildSignal() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#0b0626', 2, 70);
  const S = { scene, parts: {} };
  const r = rng(3);

  const sky = makeSkyDome(); scene.add(sky); S.sky = sky;
  const stars = makeStars(700, { radius: 600, minY: -0.3, density: 1, seed: 12 });
  const starGroup = new THREE.Group(); starGroup.add(stars); scene.add(starGroup); S.stars = stars; S.starGroup = starGroup;
  const msgStars = glowPoints(64, { fade: 2000 }); msgStars.geometry.setDrawRange(0, 0); starGroup.add(msgStars); S.msgStars = msgStars;

  const sea = makeSea(); scene.add(sea); S.sea = sea;
  // the sea isn't inked (its waves move in the shader), so a flat stand-in at sea level writes into the
  // ink pass only: it hides outlines on the far side of the surface and draws the waterline on the sea stack
  for (const flip of [false, true]) {
    const g = new THREE.PlaneGeometry(900, 900); g.rotateX(flip ? Math.PI / 2 : -Math.PI / 2);
    const occ = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    occ.userData.inkGroup = 'sea'; occ.frustumCulled = false; scene.add(occ);
  }

  /* ---- the deep ---- */
  const deep = new THREE.Group(); scene.add(deep); S.deep = deep;
  deep.add(makeTrench());
  const kelp = makeKelp(); deep.add(kelp); S.kelp = kelp;
  // coral gardens: on the floor around the title, and on the wall ledges
  const tipPos = [], tipCol = [];
  const glowCols = [GLOW.lime, GLOW.cyan, GLOW.pink, GLOW.lilac];
  for (let i = 0; i < 46; i++) {
    const onWall = i > 20;
    let x, z;
    if (onWall) { const side = r() > 0.5 ? 1 : -1; x = 2 + side * (15 + r() * 14); z = -40 + r() * 60; }
    else { x = -22 + r() * 48; z = -30 + r() * 36; }
    const y = floorH(x, z);
    if (onWall && y > -40) continue;
    const tone = [T.coralA, T.coralB, T.coralC][i % 3];
    const c = makeCoral(100 + i, 0.9 + r() * 1.6, tone);
    c.mesh.position.set(x, y - 0.3, z); c.mesh.rotation.y = r() * 6; deep.add(c.mesh);
    c.mesh.updateMatrixWorld();
    const gc = glowCols[i % 4];
    for (const t of c.tips) { tipPos.push(t.clone().applyMatrix4(c.mesh.matrixWorld)); tipCol.push(gc); }
  }
  // barnacle lights up the sea stack
  for (let i = 0; i < 90; i++) {
    const a = r() * PI * 2, y = -135 + r() * 128, rad = 6 + (1 - (y + 140) / 150) * 3.2;
    tipPos.push(new THREE.Vector3(STATION.x + Math.cos(a) * rad, y, STATION.z + Math.sin(a) * rad)); tipCol.push(glowCols[(i * 7) % 4]);
  }
  const tips = glowPoints(tipPos.length, { fade: 90 });
  { const P = tips.geometry.attributes.position.array, C = tips.geometry.attributes.aColor.array, Z = tips.geometry.attributes.aSize.array;
    tipPos.forEach((p, i) => { P.set([p.x, p.y, p.z], i * 3); setC(C, i, tipCol[i], 1.1); Z[i] = 0.9 + r() * 0.9; }); }
  deep.add(tips); S.tips = tips;

  // drifting plankton everywhere in the deep
  const AMB = 2600, amb = glowPoints(AMB, { drift: 0.8, fade: 70 });
  { const P = amb.geometry.attributes.position.array, C = amb.geometry.attributes.aColor.array, Z = amb.geometry.attributes.aSize.array;
    for (let i = 0; i < AMB; i++) { P.set([-40 + r() * 84, -140 + r() * 138, -50 + r() * 78], i * 3); setC(C, i, glowCols[Math.floor(r() * 4)], 0.25 + r() * 0.55); Z[i] = 0.12 + r() * 0.32; } }
  deep.add(amb); S.amb = amb;

  // bubble columns from vents on the floor
  const BUB = 520, bub = glowPoints(BUB, { fade: 70 });
  const vents = Array.from({ length: 7 }, () => [-16 + r() * 34, -30 + r() * 36]);
  const bubSeeds = new Float32Array(BUB * 3);
  { const C = bub.geometry.attributes.aColor.array, Z = bub.geometry.attributes.aSize.array;
    for (let i = 0; i < BUB; i++) { const v = vents[i % vents.length]; bubSeeds.set([v[0] + (r() - 0.5) * 1.5, v[1] + (r() - 0.5) * 1.5, r()], i * 3); setC(C, i, '#b8c8ff', 0.5); Z[i] = 0.12 + r() * 0.22; } }
  deep.add(bub); S.bub = bub; S.bubSeeds = bubSeeds;

  // god rays under the surface
  const rays = [];
  for (let i = 0; i < 14; i++) {
    const w = 3 + r() * 7, h = 60 + r() * 40;
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, -h / 2, 0);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: { value: 0 }, uPh: { value: r() * 6 }, uAmp: { value: 1 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uTime, uPh, uAmp; varying vec2 vUv;
        void main(){ float a = pow(vUv.y, 2.2) * sin(3.14159 * vUv.x) * (0.55 + 0.45 * sin(uTime * 0.7 + uPh)) * 0.22 * uAmp; gl_FragColor = vec4(vec3(0.62, 0.66, 1.0) * a, 1.0); }`,
    });
    const ray = new THREE.Mesh(geo, m); ray.position.set(-30 + r() * 64, -0.5, -45 + r() * 60);
    ray.rotation.set((r() - 0.5) * 0.25, r() * PI, 0.18 + (r() - 0.5) * 0.15); ray.userData.noInk = true; deep.add(ray); rays.push(ray);
  }
  S.rays = rays;

  // jellyfish
  S.jellies = [];
  for (let i = 0; i < 11; i++) {
    const j = makeJelly(glowCols[(i + 1) % 4], 0.7 + r() * 1.1, i + 1);
    const side = i % 2 ? 1 : -1;
    const home = new THREE.Vector3(side * (6 + r() * 9), -112 + i * 9 + r() * 4, -14 + r() * 22);
    j.group.position.copy(home); deep.add(j.group);
    S.jellies.push({ ...j, home, phase: r() * 6 });
  }

  // schools of glowing fish that swirl round a lure near you
  S.schools = [makeSchool(90, [GLOW.cyan, '#9fe9ff', GLOW.lilac], 7), makeSchool(70, [GLOW.pink, '#ffb0e8', GLOW.peach], 8), makeSchool(60, [GLOW.lime, '#c9ffb0', GLOW.cyan], 9)];
  S.schools.forEach((sc) => deep.add(sc.mesh));
  // the trail your cursor leaves in the deep
  const TRAIL = 320, trail = glowPoints(TRAIL, { fade: 60 });
  { const C = trail.geometry.attributes.aColor.array; for (let i = 0; i < TRAIL; i++) setC(C, i, glowCols[i % 4], 1); }
  deep.add(trail); S.trail = { points: trail, vel: new Float32Array(TRAIL * 3), life: new Float32Array(TRAIL), base: new Float32Array(TRAIL), i: 0 };

  // the three notes pin to pearls in clams on rock ledges, one per depth
  S.clams = [[-13.5, -105, -3, '#9fe9ff'], [9.5, -81, -6, '#ff9be4'], [-15, -53, -6, '#b8ffb0']].map(([x, y, z, c], i) => {
    const cl = makeClam(c, 400 + i); cl.position.set(x, y, z); cl.rotation.y = 0.5 - i * 0.4; deep.add(cl); return cl;
  });

  // the whale, and a second one for the breach
  const whale = makeWhale(); whale.position.set(-80, -64, -32); deep.add(whale); S.whale = whale;
  const breacher = makeWhale(); breacher.visible = false; breacher.scale.setScalar(0.85); scene.add(breacher); S.breacher = breacher;

  // the sea stack runs from the deep up to the station
  scene.add(makePillar());

  /* ---- the plankton title ---- */
  const TITLE_MAX = 6000, title = glowPoints(TITLE_MAX, { fade: 80 });
  title.geometry.setDrawRange(0, 0); scene.add(title); S.title = title;
  S.titleState = { n: 0, home: null, vel: null };

  /* ---- above the water ---- */
  const storm = new THREE.Group(); scene.add(storm); S.storm = storm;
  const st = makeStation(); storm.add(st.group); S.station = st;
  // distant sea stacks
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + (i / 8) * 2.4 + (r() - 0.5) * 0.2, d = 70 + r() * 110;
    const rock = makeRock({ seed: 200 + i, tone: T.pillar, squash: [0.8, 2.2 + r() * 2, 0.8] });
    const s = 3 + r() * 6; rock.scale.setScalar(s);
    rock.position.set(STATION.x + Math.sin(a) * d, s * 0.5, STATION.z - Math.cos(a) * d); storm.add(rock);
  }
  // storm clouds share one material so lightning can light them all
  const cloudMat = toon(T.storm, { t1: -0.1, t2: 0.62, rim: 0.12 }); S.cloudMat = cloudMat;
  S.clouds = [];
  for (let i = 0; i < 46; i++) {
    const near = i < 10;
    const a = near ? r() * PI * 2 : -1.5 + r() * 3.0, d = near ? 10 + r() * 28 : 70 + r() * 170;
    const c = makeCloud({ seed: 300 + i, puffs: 6 + (i % 4) }); c.material = cloudMat;
    const s = near ? 4 + r() * 4 : 7 + r() * 9; c.scale.set(s * 1.4, s * 0.8, s);
    const home = new THREE.Vector3(STATION.x + Math.sin(a) * d, (near ? 34 : 30) + r() * 16, STATION.z - Math.cos(a) * d);
    c.position.copy(home); c.rotation.y = r() * 6; storm.add(c);
    S.clouds.push({ mesh: c, home, push: 0 });
  }
  const rain = makeRain(); storm.add(rain); S.rain = rain;
  S.auroras = [makeAurora({ z: -250, y: 62, w: 520, h: 130, seed: 0, bend: 60 }), makeAurora({ z: -200, y: 80, w: 380, h: 100, seed: 3, bend: 40 }), makeAurora({ z: -300, y: 50, w: 600, h: 150, seed: 7, bend: 80 })];
  S.auroras.forEach((a) => scene.add(a));
  // buoys: one per way to reach me
  S.buoys = [
    { id: 'email', color: GLOW.lime, at: new THREE.Vector3(-4, 0, -2), lift: 6 },
    { id: 'linkedin', color: GLOW.lilac, at: new THREE.Vector3(12, 0, -6), lift: 10 },
    { id: 'github', color: GLOW.pink, at: new THREE.Vector3(30, 0, -18), lift: 6 },
  ].map((b) => { const g = makeBuoy(b.color); g.scale.setScalar(1.45); g.position.copy(b.at); g.userData.top.y = b.lift; storm.add(g); return { ...b, group: g, morse: null }; });
  // lightning
  const boltGeo = new THREE.BufferGeometry();
  const bolt = new THREE.LineSegments(boltGeo, new THREE.LineBasicMaterial({ color: '#e6fbff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  bolt.frustumCulled = false; bolt.userData.noInk = true; storm.add(bolt);
  const boltGlow = glowSprite('#9fe9ff', 70, 0); storm.add(boltGlow);
  S.bolt = { line: bolt, glow: boltGlow, t: 9, makeBolt: () => makeBolt(rng(Math.floor(Math.random() * 1e6))) };

  /* ---- the transmission ---- */
  const beam = new THREE.Group(); beam.visible = false; scene.add(beam);
  const bgeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true); bgeo.translate(0, 0.5, 0);
  const inner = new THREE.Mesh(bgeo, beamMaterial('#f6ffef', GLOW.lime, 1)); inner.scale.set(0.9, 1, 0.9);
  const outer = new THREE.Mesh(bgeo, beamMaterial(GLOW.lime, '#8a47ff', 0.4)); outer.scale.set(3.4, 1, 3.4);
  const halo = new THREE.Mesh(bgeo, beamMaterial('#b25cff', '#5a2bd0', 0.2)); halo.scale.set(8, 1, 8);
  [inner, outer, halo].forEach((m) => { m.userData.noInk = true; m.frustumCulled = false; beam.add(m); });
  const flare = glowSprite('#efffe8', 0.001); beam.add(flare);
  S.beam = { group: beam, layers: [inner, outer, halo], flare };
  const ringMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uAmp: { value: 0 }, uColor: { value: new THREE.Color('#d9c4ff') } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uAmp; uniform vec3 uColor; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; float a = smoothstep(0.78, 0.97, r) * smoothstep(1.0, 0.97, r) + smoothstep(0.5, 0.97, r) * smoothstep(1.0, 0.95, r) * 0.25; gl_FragColor = vec4(uColor * a * uAmp, 1.0); }`,
  });
  const shock = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ringMat); shock.rotation.x = -PI / 2; shock.position.set(STATION.x, 40, STATION.z); shock.visible = false; shock.userData.noInk = true; scene.add(shock);
  S.shock = shock;
  const sat = makeSatellite(); scene.add(sat); S.sat = sat;
  const meteors = makeMeteors(); scene.add(meteors.lines); S.meteors = meteors;
  const newStar = glowSprite(GLOW.lime, 0.001); scene.add(newStar); S.newStar = newStar;

  // spray when you break the surface
  const SPRAY = 260, spray = glowPoints(SPRAY, { fade: 60 });
  { const C = spray.geometry.attributes.aColor.array; for (let i = 0; i < SPRAY; i++) setC(C, i, '#e6deff', 0.8); }
  spray.visible = false; scene.add(spray);
  S.spray = { points: spray, vel: new Float32Array(SPRAY * 3), life: 0 };

  return S;
}
