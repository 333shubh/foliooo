import * as THREE from 'three';
import { toon, setLight } from './materials.js';
import { rng, fbm, makeSky, makeStars, makeCloud, makeRock, makeShard, makeGem, makeTree, makeTerrain, makeWater, makePlanet, makeRingedPlanet } from './props.js';
import { rig, bob, tumble } from './worlds.js';
import { buildSignal, glowSprite, glowPoints, STATION, waveAt } from '../../contact/signal.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ==========================================================================
   The cockpit windows. Each one looks out on its page's own world, turned up:
     aboutWindow    a forest that glows at night: giant mushrooms, a stream of
                    light, vine-hung trees, spiral plants, fireflies, drifting seeds
     workWindow     deep space: a nebula sky, a ringed giant, a teal planet,
                    an asteroid belt, crystal shards and comets
     contactWindow  the Contact page's relay station in its sunset storm
   ========================================================================== */
const PI = Math.PI;
const tone = (shade, base, light) => ({ shade, base, light });
const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

/* ---------------------------------------------------------------- ABOUT: a forest that glows at night */
export function makeMushroom(r, h, capT, glow, seed) {
  const g = new THREE.Group(), rn = rng(seed);
  const pts = [[0.34, 0], [0.24, 0.25], [0.2, 0.6], [0.22, 0.92], [0.3, 1]].map(([x, y]) => new THREE.Vector2(x * r * 0.55, y * h));
  const stem = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), toon(tone('#3a2c6e', '#7d6cc0', '#d8ccff'), { rim: 0.25, t1: -0.1, t2: 0.6 }));
  g.add(stem);
  const capGeo = new THREE.SphereGeometry(r, 36, 14, 0, PI * 2, 0, PI * 0.5);
  const p = capGeo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y * 0.5 + Math.sin(a * 7 + seed) * 0.04 * r * (1 - y / r)); }
  capGeo.computeVertexNormals();
  const cap = new THREE.Mesh(capGeo, toon(capT, { rim: 0.3, t1: -0.05, t2: 0.6 })); cap.position.y = h; g.add(cap);
  const gills = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 36), glowMat(glow, 0.7)); gills.rotation.x = PI / 2; gills.position.y = h - 0.02; gills.userData.noInk = true; g.add(gills);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.25, r * 0.98, 36, 1), glowMat('#ffffff', 0.25)); ring.rotation.x = PI / 2; ring.position.y = h - 0.03; ring.userData.noInk = true; g.add(ring);
  const spots = [];
  for (let i = 0; i < 12; i++) {
    const t = 0.25 + rn() * 1.05, ph = rn() * PI * 2, s = (0.05 + rn() * 0.08) * r;
    const sg = new THREE.SphereGeometry(s, 8, 6); sg.translate(Math.sin(t) * Math.cos(ph) * r * 0.97, h + Math.cos(t) * r * 0.5, Math.sin(t) * Math.sin(ph) * r * 0.97); spots.push(sg);
  }
  const sp = new THREE.Mesh(mergeGeometries(spots), glowMat('#ffffff', 0.85)); sp.userData.noInk = true; g.add(sp);
  const halo = glowSprite(glow, r * 4.2, 0.5); halo.position.y = h - r * 0.15; g.add(halo);
  const pool = glowSprite(glow, r * 3, 0.3); pool.position.y = 0.2; g.add(pool);
  g.userData = { halo, gills, ph: rn() * 6 };
  return g;
}
export function makeGlowTree(seed, h) {
  const g = new THREE.Group(), rn = rng(seed), bark = toon(tone('#120a2a', '#22164a', '#3e2c78'), { rim: 0.12 });
  const trunk = new THREE.CylinderGeometry(0.5, 1.3, h, 10, 12), p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h + 0.5; p.setX(i, p.getX(i) + Math.sin(y * 3 + seed) * 0.8 * y); }
  trunk.computeVertexNormals(); trunk.translate(0, h / 2, 0);
  g.add(new THREE.Mesh(trunk, bark));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2 + rn(), root = new THREE.Mesh(new THREE.ConeGeometry(0.45, 4, 6), bark);
    root.position.set(Math.cos(a) * 1.4, 1, Math.sin(a) * 1.4); root.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(root);
  }
  const leafT = tone('#0b2a3a', '#124a5a', '#1f7a80');
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(3 + rn() * 2.5, 14, 10), toon(leafT, { rim: 0.2 }));
    c.scale.set(1.4, 0.5, 1.2); c.position.set((rn() - 0.5) * 6 + Math.sin(1 + seed) * 0.8, h + (rn() - 0.5) * 2, (rn() - 0.5) * 5); g.add(c);
  }
  // glowing vines hanging from the canopy, each ending in a bead of light
  const vinePts = [], beads = [];
  const vc = ['#71f0ff', '#ff7ad9', '#b8ffb0'][seed % 3];
  for (let i = 0; i < 14; i++) {
    const x = (rn() - 0.5) * 9, z = (rn() - 0.5) * 7, len = 3 + rn() * 7;
    for (let k = 0; k < 8; k++) vinePts.push(new THREE.Vector3(x + Math.sin(k) * 0.12, h - 1 - (k / 8) * len, z), new THREE.Vector3(x + Math.sin(k + 1) * 0.12, h - 1 - ((k + 1) / 8) * len, z));
    beads.push([x, h - 1 - len, z]);
  }
  const vines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(vinePts), new THREE.LineBasicMaterial({ color: vc, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  vines.userData.noInk = true; g.add(vines);
  beads.forEach(([x, y, z]) => { const b = glowSprite(vc, 1.1, 0.9); b.position.set(x, y, z); g.add(b); });
  return g;
}
export function makeSpiral(color, h, seed) {
  const g = new THREE.Group(), rn = rng(seed), pts = [];
  for (let i = 0; i <= 120; i++) { const u = i / 120, a = u * PI * 2 * 4.5; pts.push(new THREE.Vector3(Math.cos(a) * (0.9 - u * 0.75), u * h, Math.sin(a) * (0.9 - u * 0.75))); }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.09, 5), glowMat(color, 0.9)); tube.userData.noInk = true; g.add(tube);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.2, h, 6), toon(tone('#1a0f36', '#2e1d5c', '#4e3a90'))); stalk.position.y = h / 2; g.add(stalk);
  const tip = glowSprite(color, 2.6, 0.9); tip.position.y = h + 0.2; g.add(tip);
  g.userData = { tip, ph: rn() * 6 };
  return g;
}
const streamX = (z) => Math.sin(z * 0.06) * 6 + Math.sin(z * 0.021 + 1) * 5;
function makeStream() {
  const N = 220, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const z = 30 - (i / N) * 150, x = streamX(z), dx = (streamX(z - 0.5) - streamX(z + 0.5));
    const w = 1.8 + Math.max(0, z) * 0.06, nx = 1 / Math.hypot(1, dx), nz = dx * nx;
    pos.push(x - nx * w, 0.08, z - nz * w, x + nx * w, 0.08, z + nz * w); uv.push(0, i / N, 1, i / N);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    fog: false, uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform float uTime; varying vec2 vUv; varying float vD; ${NOISE}
      void main() {
        float across = abs(vUv.x - 0.5) * 2.0;
        float flow = fbm(vec2(vUv.x * 5.0, vUv.y * 70.0 - uTime * 1.6));
        float streak = smoothstep(0.55, 0.85, fbm(vec2(vUv.x * 9.0 + 3.0, vUv.y * 140.0 - uTime * 3.2)));
        vec3 deep = vec3(0.02, 0.12, 0.22), cyan = vec3(0.3, 0.95, 1.0), lilac = vec3(0.75, 0.5, 1.0);
        vec3 c = mix(deep, mix(cyan, lilac, vn(vec2(vUv.y * 20.0, uTime * 0.2))), flow * 0.75);
        c += vec3(0.85, 1.0, 1.0) * streak * 0.8;
        c += cyan * smoothstep(0.75, 1.0, across) * 0.6;                         // bright banks
        c *= 1.0 - smoothstep(60.0, 150.0, vD) * 0.7;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, m); mesh.userData.noInk = true; return mesh;
}

export function aboutWindow() {
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog('#100736', 18, 140);
  const w = { pal: { light: [-0.45, 0.8, 0.35] }, scene, anchors: {}, tick: [], pre: [] }, r = rng(41);
  scene.add(makeSky(['#04021a', '#160a48', '#36166e'], 330));
  const stars = makeStars(500, { radius: 320, minY: 0.05, seed: 8 }); scene.add(stars);
  w.tick.push((dt, t) => { stars.material.uniforms.uTime.value = t; });
  // a huge pale planet low in the sky, and a small moon
  const world = makePlanet({ radius: 60, tone: tone('#3a3a9a', '#6a7ad8', '#c8d4ff'), seed: 6 }); world.position.set(-70, 40, -300); scene.add(world);
  const worldGlow = glowSprite('#8fa8ff', 200, 0.4); worldGlow.position.set(-70, 40, -298); scene.add(worldGlow);
  const moon = makePlanet({ radius: 9, tone: tone('#a85a9a', '#e08ac8', '#ffd0f0'), seed: 2 }); moon.position.set(70, 70, -290); scene.add(moon);
  w.tick.push((dt) => { world.rotation.y += dt * 0.01; });
  // the forest floor, cut by the stream
  const ground = (x, z) => {
    const d = Math.abs(x - streamX(z));
    return fbm(x * 0.05, z * 0.05 + 2, 4) * 5 - 1 + Math.max(0, Math.abs(x) - 14) * 0.18 - (1 - THREE.MathUtils.smoothstep(d, 1.5, 5)) * 1.6;
  };
  scene.add(makeTerrain({ size: 220, depth: 170, seg: 170, height: ground, tone: tone('#070418', '#120a30', '#24164e'), cz: -50 }));
  const stream = makeStream(); scene.add(stream);
  w.tick.push((dt, t) => { stream.material.uniforms.uTime.value = t; });
  // glowing moss over the floor, thickest along the banks
  const MOSS = 3600, moss = glowPoints(MOSS, { fade: 130 });
  { const P = moss.geometry.attributes.position.array, C = moss.geometry.attributes.aColor.array, Z = moss.geometry.attributes.aSize.array, c = new THREE.Color();
    const cols = ['#4fe0ff', '#7bf583', '#ff7ad9', '#a98bff'];
    for (let i = 0; i < MOSS; i++) {
      const z = 26 - r() * 140, bank = r() < 0.55, x = bank ? streamX(z) + (r() < 0.5 ? -1 : 1) * (2 + r() * 4) : (r() - 0.5) * 90;
      P.set([x, ground(x, z) + 0.15, z], i * 3); c.set(cols[(i * 7) % 4]).multiplyScalar(0.4 + r() * 0.7); C.set([c.r, c.g, c.b], i * 3); Z[i] = 0.12 + r() * 0.26;
    } }
  scene.add(moss);
  // fireflies drifting everywhere
  const FF = 260, flies = glowPoints(FF, { drift: 1.6, fade: 90 });
  { const P = flies.geometry.attributes.position.array, C = flies.geometry.attributes.aColor.array, Z = flies.geometry.attributes.aSize.array;
    for (let i = 0; i < FF; i++) { P.set([(r() - 0.5) * 70, 1 + r() * 14, 20 - r() * 90], i * 3); const k = r(); C.set(k < 0.7 ? [0.85, 1, 0.5] : [1, 0.85, 0.4], i * 3); Z[i] = 0.18 + r() * 0.26; } }
  scene.add(flies);
  w.pre.push((dt, t, stage) => { [moss, flies].forEach((pts) => { pts.material.uniforms.uTime.value = t; pts.material.uniforms.uPx.value = stage.h / 900; }); });
  // giant glowing mushrooms in clusters
  const capTones = [[tone('#5a0f4a', '#b0247e', '#ff6ac0'), '#ff4fb8'], [tone('#0a3a5a', '#1279a8', '#5ae0ff'), '#3fd8ff'], [tone('#1f4a10', '#4a9a22', '#b8ff6a'), '#8cff5a'], [tone('#3a1a7a', '#6a3ac8', '#c08cff'), '#a070ff']];
  const shrooms = [];
  for (let i = 0, n = 0; i < 200 && n < 26; i++) {
    const z = 12 - r() * 100, side = r() < 0.5 ? -1 : 1, x = streamX(z) + side * (4.5 + r() * 26);
    const big = n < 10, rr = big ? 3 + r() * 3.5 : 0.7 + r() * 1.6, hh = big ? 6 + r() * 7 : 1.2 + r() * 2.4;
    const [ct, gc] = capTones[n % 4];
    const m = makeMushroom(rr, hh, ct, gc, 70 + n); m.position.set(x, ground(x, z) - 0.2, z); m.rotation.set((r() - 0.5) * 0.25, r() * 6, (r() - 0.5) * 0.25); scene.add(m); shrooms.push(m); n++;
    // small ones gather round a big one
    if (big) for (let k = 0; k < 4; k++) {
      const a = r() * PI * 2, d = rr + 1 + r() * 2.5, xs = x + Math.cos(a) * d, zs = z + Math.sin(a) * d;
      const s = makeMushroom(0.4 + r() * 0.7, 0.8 + r() * 1.4, ct, gc, 140 + n * 5 + k); s.position.set(xs, ground(xs, zs) - 0.1, zs); scene.add(s); shrooms.push(s);
    }
  }
  // two giants framing the foreground
  [[-9, 9, 4.2, 8.5, 0], [10, 2, 3.4, 6.5, 1]].forEach(([x, z, rr, hh, k]) => {
    const [ct, gc] = capTones[k]; const m = makeMushroom(rr, hh, ct, gc, 300 + k); m.position.set(x, ground(x, z) - 0.2, z); m.rotation.z = k ? -0.12 : 0.1; scene.add(m); shrooms.push(m);
  });
  // coloured mist hanging low between the trees
  for (let i = 0; i < 14; i++) {
    const z = 10 - r() * 90, x = (r() - 0.5) * 60, mist = glowSprite(['#2fd8ff', '#ff4fb8', '#8c6bff', '#7bf583'][i % 4], 18 + r() * 22, 0.13);
    mist.position.set(x, 1.5 + r() * 2.5, z); scene.add(mist);
  }
  w.tick.push((dt, t) => shrooms.forEach((m) => { const k = 0.75 + Math.sin(t * 1.2 + m.userData.ph) * 0.25; m.userData.halo.material.opacity = 0.5 * k; m.userData.gills.material.opacity = 0.55 + 0.3 * k; }));
  // tall trees hung with glowing vines, framing the stream
  [[-16, -6, 22], [17, -14, 26], [-26, -34, 30], [24, -44, 28], [-12, -60, 24], [10, -78, 30], [-30, -84, 32], [32, -20, 34]].forEach(([x, z, h], i) => {
    const tr = makeGlowTree(i, h); tr.position.set(x, ground(x, z) - 0.5, z); tr.rotation.y = r() * 6; scene.add(tr);
  });
  // spiral plants coiled in light
  const spirals = [];
  for (let i = 0; i < 14; i++) {
    const z = 14 - r() * 80, x = streamX(z) + (r() < 0.5 ? -1 : 1) * (2.8 + r() * 10);
    const sp = makeSpiral(['#ff9a4a', '#ff5fb8', '#71f0ff', '#c9ff6a'][i % 4], 2 + r() * 3.5, i); sp.position.set(x, ground(x, z) - 0.1, z); scene.add(sp); spirals.push(sp);
  }
  w.tick.push((dt, t) => spirals.forEach((s) => { s.rotation.y += dt * 0.4; s.userData.tip.material.opacity = 0.6 + Math.sin(t * 2 + s.userData.ph) * 0.35; }));
  // lantern flowers along the water
  for (let i = 0; i < 30; i++) {
    const z = 20 - r() * 70, x = streamX(z) + (r() < 0.5 ? -1 : 1) * (1.8 + r() * 2);
    const stalkH = 0.6 + r() * 1.2, y = ground(x, z);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, stalkH, 4), toon(tone('#123a2a', '#1f6a4a', '#3aa070'))); stalk.position.set(x, y + stalkH / 2, z); scene.add(stalk);
    const c = ['#ffb04a', '#ff6ac0', '#ffe066'][i % 3];
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glowMat(c, 1)); bulb.position.set(x, y + stalkH + 0.1, z); bulb.userData.noInk = true; scene.add(bulb);
    const halo = glowSprite(c, 1.4, 0.7); halo.position.copy(bulb.position); scene.add(halo);
  }
  // glowing seeds drifting up out of the forest
  const seeds = Array.from({ length: 36 }, (_, i) => {
    const s = glowSprite(i % 3 ? '#dff8ff' : '#b8ffb0', 0.9 + r() * 1.2, 0.85); s.position.set((r() - 0.5) * 50, r() * 18, 14 - r() * 70); scene.add(s);
    return { s, sp: 0.4 + r() * 0.6, ph: r() * 6 };
  });
  w.tick.push((dt, t) => seeds.forEach((o) => { o.s.position.y += dt * o.sp; o.s.position.x += Math.sin(t * 0.7 + o.ph) * dt * 0.6; if (o.s.position.y > 22) o.s.position.y = 0; }));
  return rig(w, { pos: [1, 4.2, 26], look: [-1, 4.5, -40], sway: [2.2, 0.9], fov: 48 });
}

/* ---------------------------------------------------------------- WORK */
export const NOISE = /* glsl */ `
  float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }`;
function nebulaSky() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime; varying vec3 vP; ${NOISE}
      void main() {
        vec3 d = vP * 2.2;
        float a = fbm(d.xy + d.z * 0.6 + 3.0), b = fbm(d.zy * 1.3 - d.x * 0.5 + 11.0), c = fbm(d.xz * 0.9 + 21.0 + uTime * 0.01);
        vec3 col = vec3(0.03, 0.01, 0.08);
        col += vec3(0.55, 0.16, 0.8) * pow(a, 2.6) * 1.6;
        col += vec3(1.0, 0.3, 0.6) * pow(b, 3.2) * 1.7;
        col += vec3(0.15, 0.8, 0.95) * pow(c, 3.6) * 1.6;
        col += vec3(1.0, 0.75, 0.3) * pow(fbm(d.yx * 1.8 + 31.0), 5.0) * 1.4;
        float lane = smoothstep(0.35, 0.0, abs(vP.y + vP.x * 0.35 - 0.05));        // a bright galactic lane across the sky
        col += vec3(0.75, 0.55, 1.0) * lane * (0.25 + 0.5 * a);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(360, 48, 24), m); s.userData.noInk = true; return s;
}
function makeComet(color) {
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(1.1, 18, 16, 1, true); geo.translate(0, -9, 0); geo.rotateX(PI / 2);   // the tail trails along −z
  const tail = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `varying float vK; void main(){ vK = clamp(-position.z / 18.0, 0.0, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; varying float vK; void main(){ gl_FragColor = vec4(uColor * pow(1.0 - vK, 2.2) * 0.9, 1.0); }`,
  }));
  tail.userData.noInk = true; g.add(tail);
  const head = glowSprite('#ffffff', 3.2, 1); g.add(head);
  const glow = glowSprite(color, 9, 0.8); g.add(glow);
  return g;
}

export function workWindow() {
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog('#160838', 140, 420);
  const w = { pal: { light: [-0.7, 0.45, 0.55] }, scene, anchors: {}, tick: [], pre: [] }, r = rng(77);
  const sky = nebulaSky(); scene.add(sky); w.tick.push((dt, t) => { sky.material.uniforms.uTime.value = t; });
  const stars = makeStars(900, { radius: 330, minY: -1, seed: 5 }); scene.add(stars);
  w.tick.push((dt, t) => { stars.material.uniforms.uTime.value = t; });
  for (const [x, y, z, s, c] of [[-120, 60, -260, 220, '#b04cff'], [140, -20, -250, 200, '#ff4f9a'], [30, 90, -280, 160, '#4fd8ff'], [-40, -70, -240, 150, '#ffb04a']]) {
    const n = glowSprite(c, s, 0.35); n.position.set(x, y, z); scene.add(n);
  }
  // a ringed giant, a teal world with an atmosphere, a lava moon
  const giant = makeRingedPlanet({ radius: 15, bands: ['peach', 'coral', 'peach', 'coral', 'peach', 'coral', 'peach'] });
  giant.position.set(-24, -3, -72); giant.rotation.set(0.3, 0.4, 0.38); scene.add(giant);
  w.tick.push((dt) => { giant.children[0].rotation.y += dt * 0.05; });
  const teal = makePlanet({ radius: 7.5, tone: tone('#0f4f74', '#1fa3b8', '#8af0f0'), seed: 9 }); teal.position.set(27, 13, -86); scene.add(teal);
  const atmo = glowSprite('#71f0ff', 30, 0.55); atmo.position.copy(teal.position); scene.add(atmo);
  w.tick.push((dt) => { teal.rotation.y += dt * 0.08; });
  const lava = makePlanet({ radius: 3, tone: tone('#8a1f3a', '#ff5a5a', '#ffb08a'), seed: 3 }); lava.position.set(14, -11, -44); scene.add(lava);
  const lavaGlow = glowSprite('#ff6a4a', 12, 0.5); lavaGlow.position.copy(lava.position); scene.add(lavaGlow);
  // an asteroid belt sweeping across the view
  const belt = new THREE.Group(); belt.position.set(0, -2, -60); belt.rotation.set(0.35, 0, -0.18); scene.add(belt);
  const rockTones = ['rock', 'violet', tone('#7a2a4a', '#b8506a', '#ff8fa0'), tone('#3a2a6a', '#5a4aa0', '#8a7ad8')];
  for (let i = 0; i < 80; i++) {
    const a = r() * PI * 2, rad = 34 + r() * 14, s = 0.35 + Math.pow(r(), 2.4) * 2.4;
    const rock = makeRock({ seed: 500 + i, tone: rockTones[i % 4], squash: [1, 0.7 + r() * 0.4, 1] });
    rock.scale.setScalar(s); rock.position.set(Math.cos(a) * rad, (r() - 0.5) * 3, Math.sin(a) * rad); belt.add(rock);
    w.tick.push(tumble(rock, 0.1 + r() * 0.3));
  }
  w.tick.push((dt) => { belt.rotation.y += dt * 0.025; });
  // crystal shards and a lime gem tumbling close by
  for (let i = 0; i < 22; i++) {
    const sh = makeShard({ tone: ['lime', 'crystal', 'cloudPink'][i % 3], len: 0.7 + r() * 1.4, w: 0.18 + r() * 0.14 });
    sh.position.set((r() - 0.5) * 44, (r() - 0.5) * 24, -8 - r() * 30); sh.rotation.set(r() * 6, r() * 6, r() * 6); scene.add(sh);
    w.tick.push(tumble(sh, 0.4 + r() * 0.6), bob(sh, 0.4, 0.4 + r(), r() * 6));
  }
  const gem = makeGem({ size: 1.5 }); gem.position.set(-10, -6, -6); scene.add(gem); w.tick.push(tumble(gem, 0.3), bob(gem, 0.5, 0.8));
  const gemGlow = glowSprite('#7bf583', 8, 0.5); gem.add(gemGlow);
  // comets streaking past
  const comets = ['#71f0ff', '#ff7ad9', '#c9ffb0'].map((c, i) => {
    const cm = makeComet(c); scene.add(cm);
    const st = { cm, v: new THREE.Vector3(), t: -i * 2.5 };
    const reset = () => {
      const y = 8 + r() * 26, z = -40 - r() * 70;
      cm.position.set(-90, y, z); st.v.set(26 + r() * 18, -6 - r() * 8, 4 + r() * 6);
      cm.lookAt(cm.position.clone().sub(st.v));
    };
    reset(); st.reset = reset; return st;
  });
  w.tick.push((dt) => comets.forEach((st) => { st.t += dt; if (st.t < 0) { st.cm.visible = false; return; } st.cm.visible = true; st.cm.position.addScaledVector(st.v, dt); if (st.cm.position.x > 90) { st.reset(); st.t = -1 - Math.random() * 3; } }));
  return rig(w, { pos: [0, 3, 30], look: [0, 0, -50], sway: [2.4, 1.3], fov: 46 });
}

/* ---------------------------------------------------------------- CONTACT */
export function contactWindow() {
  const S = buildSignal();
  S.deep.visible = false; S.title.visible = false; S.sat.visible = false; S.spray.points.visible = false;
  S.scene.fog.color.set('#4a2272'); S.scene.fog.near = 30; S.scene.fog.far = 280;
  const su = S.sky.material.uniforms; su.uUnder.value = 0; su.uAlt.value = 0; su.uFog.value.set('#4a2272');
  S.stars.material.uniforms.uColor.value.setScalar(0.25);
  const st = S.station, dish = st.dish;
  const w = { pal: { light: [-0.55, 0.62, 0.6] }, scene: S.scene, anchors: {}, tick: [], pre: [] };
  let flash = 0, next = 3, boltT = 9;
  const cloudBase = S.cloudMat.uniforms.uBase.value.clone(), cloudLight = S.cloudMat.uniforms.uLight.value.clone(), flashC = new THREE.Color('#a8e6ff');
  w.pre.push((dt, t, stage) => {
    S.starGroup.position.copy(stage.camera.position);
    S.rain.material.uniforms.uCam.value.copy(stage.camera.position);
  });
  w.tick.push((dt, t) => {
    S.sea.material.uniforms.uTime.value = t; S.sea.material.uniforms.uFlash.value = flash;
    S.rain.material.uniforms.uTime.value = t;
    su.uTime.value = t; su.uFlash.value = flash;
    S.auroras.forEach((a) => { a.material.uniforms.uTime.value = t; });
    dish.yaw.rotation.y = -0.5 + Math.sin(t * 0.3) * 0.35; dish.pitch.rotation.x = 0.8 + Math.sin(t * 0.21) * 0.15;
    st.search.rotation.y = t * 0.45;
    const blink = (hz, off = 0, duty = 0.3) => ((t * hz + off) % 1) < duty ? 1 : 0.25;
    st.tall.userData.lamps.forEach((l, i) => { l.material.opacity = blink(0.8, i * 0.4, 0.35); });
    st.deckLamps.forEach((l, i) => { l.material.opacity = 0.35 + 0.65 * blink(0.9, i / 8); });
    for (const b of S.buoys) { const g = b.group; g.position.y = waveAt(g.position.x, g.position.z, t) * 0.9 - 0.2; }
    S.clouds.forEach((c) => { c.mesh.position.y = c.home.y + Math.sin(t * 0.2 + c.home.x) * 0.6; });
    // lightning now and then
    next -= dt; boltT += dt;
    if (next <= 0) {
      next = 4 + Math.random() * 6; boltT = 0; flash = 0.8;
      const pts = S.bolt.makeBolt(), x = STATION.x - 90 + Math.random() * 200, z = STATION.z - 60 - Math.random() * 100;
      S.bolt.line.geometry.dispose(); S.bolt.line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      S.bolt.line.position.set(x, 0, z); S.bolt.glow.position.set(x, 36, z);
    }
    const on = boltT < 0.4 ? (Math.sin(boltT * 70) > -0.3 ? 1 : 0.2) * (1 - boltT / 0.4) : 0;
    S.bolt.line.material.opacity = on; S.bolt.glow.material.opacity = on * 0.6;
    flash *= Math.exp(-dt * 4.5);
    S.cloudMat.uniforms.uBase.value.copy(cloudBase).lerp(flashC, flash * 0.35);
    S.cloudMat.uniforms.uLight.value.copy(cloudLight).lerp(flashC, flash * 0.55);
  });
  rig(w, { pos: [STATION.x - 22, 6, STATION.z + 34], look: [STATION.x - 2, 13, STATION.z], sway: [2.2, 0.9], fov: 46 });
  const attach = w.attach;
  w.attach = (stage) => {
    attach(stage);
    stage.camera.far = 900; stage.camera.updateProjectionMatrix();
    stage.post.material.uniforms.uFar.value = 900;
    setLight(w.pal.light);
  };
  return w;
}

export const WINDOWS = { aboutWindow, workWindow, contactWindow };
