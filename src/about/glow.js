import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, GRADE } from '../ds/toon/materials.js';
import { makeRingedPlanet } from '../ds/toon/props.js';
import { rng, fbm, makeSky, makeStars, makeTerrain, makePlanet } from '../ds/toon/props.js';
import { makeMushroom, makeGlowTree, makeSpiral, NOISE } from '../ds/toon/windows.js';
import { glowSprite, glowPoints } from '../contact/signal.js';

/* ==========================================================================
   THE GLOW: the About page's world. One forest at night, with a set for each
   section, each seen in its own way:
     HERO     a colossal flower in a clearing (0, 0, 0)
     ROOTS    a cutaway of glowing mycelium under the clearing (y −36)
     TREE     a giant tree whose canopy holds the project pods
     RIVER    a river of light running from the tree's roots into the far forest
   ========================================================================== */
const PI = Math.PI;
const tone = (shade, base, light) => ({ shade, base, light });
const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
export const TREE = new THREE.Vector3(58, 0, -70);
export const RIVER = { z0: -84, z1: -330 };
export const riverX = (z) => THREE.MathUtils.lerp(TREE.x - 8, -26, THREE.MathUtils.clamp((RIVER.z0 - z) / (RIVER.z0 - RIVER.z1), 0, 1)) + Math.sin(z * 0.045) * 7;
const CAP = [[tone('#5a1a08', '#b8461e', '#ff9a5a'), '#ff8a3a'], [tone('#063a34', '#0f7a6a', '#4ff0d0'), '#3fffd0'], [tone('#4a3006', '#a8740e', '#ffd25a'), '#ffc23a'], [tone('#063048', '#0f6a8e', '#5ad8ff'), '#3fd8ff']];
export const LAVA_Z = -300;   // past here the forest gives way to basalt, lava and ash

/* ---------------------------------------------------------------- ground */
export function groundAt(x, z) {
  let y = fbm(x * 0.04, z * 0.04 + 2, 4) * 6 - 1.5;
  const clear = 1 - THREE.MathUtils.smoothstep(Math.hypot(x, z + 2), 10, 26);           // the hero clearing is flat
  y = y * (1 - clear) + clear * -0.4;
  if (z < RIVER.z0 + 6 && z > RIVER.z1 - 10) { const d = Math.abs(x - riverX(z)); y -= (1 - THREE.MathUtils.smoothstep(d, 2, 6.5)) * 1.8; }
  return y;
}

/* ---------------------------------------------------------------- the bloom: a colossal flower that opens and follows you */
function petalGeo(len, wid, cup) {
  const g = new THREE.PlaneGeometry(1, 1, 6, 14), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5;                // u across, v along
    const w = Math.sin(PI * Math.pow(v, 0.8)) * wid * (1 - v * 0.2);
    p.setXYZ(i, (u - 0.5) * w, v * len, Math.pow(Math.abs(u - 0.5) * 2, 2) * cup * 0.6 + v * v * cup);
  }
  g.computeVertexNormals();
  return g;
}
function petalMat(a, b, c) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uC: { value: new THREE.Color(c) }, uTime: { value: 0 }, uGlow: { value: 1 } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv; varying vec3 vN, vV;
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vV = -mvPosition.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uA, uB, uC; uniform float uTime, uGlow; varying vec2 vUv; varying vec3 vN, vV;
      void main(){
        float v = vUv.y, u = abs(vUv.x - 0.5) * 2.0;
        vec3 c = mix(uA, uB, smoothstep(0.0, 0.7, v)); c = mix(c, uC, smoothstep(0.65, 1.0, v));
        float vein = smoothstep(0.08, 0.0, abs(fract(u * 3.0 + v * 0.6) - 0.5) - 0.38) * (0.4 + 0.6 * v);
        float pulse = 0.6 + 0.4 * sin(v * 12.0 - uTime * 2.4);
        c += uC * vein * 0.22 * pulse * uGlow;
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        c += uC * pow(f, 2.5) * 0.35 * uGlow;
        c *= 0.5 + 0.35 * smoothstep(0.0, 0.5, v);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
}
function makeBloom() {
  const g = new THREE.Group();
  const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -1, 0), new THREE.Vector3(0.6, 3, 0.4), new THREE.Vector3(-0.4, 6.5, 0.2), new THREE.Vector3(0, 9, 0)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 40, 0.55, 10), toon(tone('#0b2a12', '#17542a', '#3fa05a'), { rim: 0.25 })));
  for (const [s, a] of [[1, 0.6], [-1, 2.4], [1, 4.2]]) {                                   // big leaves at the foot
    const leaf = new THREE.Mesh(petalGeo(6.5, 3.2, 1.6), petalMat('#0a2410', '#1a5a24', '#7ae07a'));
    leaf.position.y = 0.2; leaf.rotation.order = 'YXZ'; leaf.rotation.set(-1.0, a, 0); leaf.scale.setScalar(1.1 + s * 0.1); g.add(leaf);
  }
  const head = new THREE.Group(); head.position.set(0, 9, 0); g.add(head);
  const face = new THREE.Group(); face.rotation.x = PI / 2 - 0.25; head.add(face);           // the bloom faces forward, a little up
  const layers = [
    { n: 9, len: 6.4, wid: 3.4, cup: 1.4, open: [-1.05, 0.25], cols: ['#3a0e04', '#c84a1e', '#ffb070'] },
    { n: 8, len: 4.8, wid: 2.8, cup: 1.2, open: [-1.2, 0.05], cols: ['#04282a', '#14907e', '#8affe8'] },
    { n: 7, len: 3.2, wid: 2.0, cup: 0.9, open: [-1.35, -0.25], cols: ['#3a2404', '#e8a020', '#fff0a0'] },
  ];
  const petals = [];
  layers.forEach((L, li) => {
    for (let i = 0; i < L.n; i++) {
      const pivot = new THREE.Group(); pivot.rotation.y = (i / L.n) * PI * 2 + li * 0.35; face.add(pivot);
      const m = new THREE.Mesh(petalGeo(L.len, L.wid, L.cup), petalMat(...L.cols)); m.userData.noInk = true;
      const hinge = new THREE.Group(); hinge.add(m); pivot.add(hinge);
      petals.push({ hinge, mat: m.material, open: L.open, delay: li * 0.25 + i * 0.03 });
    }
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), glowMat('#ffd890', 0.75)); core.userData.noInk = true; face.add(core);
  const coreGlow = glowSprite('#ffb04a', 5, 0.55); face.add(coreGlow);
  const stamens = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * PI * 2, len = 1.8 + (i % 3) * 0.6;
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 0.8, len, Math.sin(a) * 0.8)];
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffe08a', transparent: true, blending: THREE.AdditiveBlending, fog: false })); l.userData.noInk = true; face.add(l);
    const tip = glowSprite(i % 2 ? '#ffd25a' : '#4ff0d0', 0.9, 1); tip.position.copy(pts[1]); face.add(tip); stamens.push(tip);
  }
  // spores orbiting the head
  const SP = 500, spores = glowPoints(SP, { fade: 120 });
  const P = spores.geometry.attributes.position.array, C = spores.geometry.attributes.aColor.array, Z = spores.geometry.attributes.aSize.array, r = rng(5), col = new THREE.Color();
  const orbit = [];
  for (let i = 0; i < SP; i++) { orbit.push([r() * PI * 2, 4 + r() * 9, (r() - 0.5) * 7, 0.15 + r() * 0.35]); col.set(['#ffd8a0', '#a8fff0', '#fff0a0', '#ffffff'][i % 4]).multiplyScalar(0.6 + r() * 0.5); C.set([col.r, col.g, col.b], i * 3); Z[i] = 0.08 + r() * 0.2; }
  g.add(spores);
  const tick = (t, open, look) => {
    petals.forEach((p) => { const k = THREE.MathUtils.smoothstep(open - p.delay, 0, 1); p.hinge.rotation.x = THREE.MathUtils.lerp(p.open[0], p.open[1], k) + Math.sin(t * 1.2 + p.delay * 9) * 0.04; p.mat.uniforms.uTime.value = t; });
    head.rotation.y += (look.x * 0.45 - head.rotation.y) * 0.05;
    head.rotation.x += (-look.y * 0.3 - head.rotation.x) * 0.05;
    coreGlow.scale.setScalar(4 + Math.sin(t * 2) * 0.6 + open * 1.5);
    stamens.forEach((s, i) => { s.material.opacity = 0.6 + 0.4 * Math.sin(t * 3 + i); });
    for (let i = 0; i < SP; i++) { const o = orbit[i], a = o[0] + t * o[3]; P[i * 3] = Math.cos(a) * o[1]; P[i * 3 + 1] = 9 + o[2] + Math.sin(t * 0.7 + i) * 0.4; P[i * 3 + 2] = Math.sin(a) * o[1]; }
    spores.geometry.attributes.position.needsUpdate = true;
  };
  return { group: g, head, tick, spores };
}

/* ---------------------------------------------------------------- roots: a cutaway of glowing mycelium under the clearing */
function makeRoots() {
  const g = new THREE.Group(); g.position.set(0, -36, 0);
  // the soil wall, banded
  const wall = new THREE.BoxGeometry(150, 74, 14, 60, 30, 1), p = wall.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
  const strata = ['#1a0e08', '#24140a', '#2e1a0e', '#1e1009', '#28160c'].map((h) => new THREE.Color(h));
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); const k = Math.floor((y + 40 + fbm(x * 0.05, y * 0.02, 2) * 8) / 7); c.copy(strata[((k % 5) + 5) % 5]); cols.set([c.r, c.g, c.b], i * 3); }
  wall.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const wm = new THREE.Mesh(wall, toon(tone('#120a06', '#24140a', '#3a2414'), { vertexColors: true, t1: 0.3, t2: 0.85 })); wm.position.set(0, 0, -17); g.add(wm);
  // glowing threads branching across the face; each knows how far along itself it is (aU) and where it sits (aX)
  const r = rng(12), tubes = [];
  const thread = (start, dir, len, depth, hue) => {
    const pts = [start.clone()]; let pnt = start.clone(), d = dir.clone();
    for (let k = 0; k < 8; k++) { d.add(new THREE.Vector3((r() - 0.5) * 0.9, (r() - 0.5) * 0.9, 0)).normalize(); pnt = pnt.clone().addScaledVector(d, len / 8); pts.push(pnt); }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, depth === 0 ? 0.16 : 0.09, 5);
    const n = geo.attributes.position.count, au = new Float32Array(n), ah = new Float32Array(n).fill(hue), seed = new Float32Array(n).fill(r());
    const uvs = geo.attributes.uv; for (let k = 0; k < n; k++) au[k] = uvs.getX(k);
    geo.setAttribute('aU', new THREE.BufferAttribute(au, 1)); geo.setAttribute('aHue', new THREE.BufferAttribute(ah, 1)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    tubes.push(geo);
    if (depth < 2) for (let b = 0; b < 2; b++) { const at = pts[3 + Math.floor(r() * 4)]; thread(at, d.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), (r() - 0.5) * 2.2), len * 0.6, depth + 1, hue); }
  };
  for (let i = 0; i < 9; i++) thread(new THREE.Vector3(-70 + i * 17 + r() * 6, 30 - r() * 6, -9.6), new THREE.Vector3((r() - 0.5) * 0.6, -1, 0), 40 + r() * 20, 0, i % 3);
  for (let i = 0; i < 5; i++) thread(new THREE.Vector3(-75, -20 + i * 9, -9.6), new THREE.Vector3(1, (r() - 0.5) * 0.4, 0), 60, 0, (i + 1) % 3);
  const geo = mergeGeometries(tubes);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uReveal: { value: -80 } },
    vertexShader: /* glsl */ `attribute float aU, aHue, aSeed; varying float vU, vHue, vSeed, vX; void main(){ vU = aU; vHue = aHue; vSeed = aSeed; vec4 w = modelMatrix * vec4(position, 1.0); vX = w.x; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform float uTime, uReveal; varying float vU, vHue, vSeed, vX;
      void main(){
        vec3 c = vHue < 0.5 ? vec3(0.3, 1.0, 0.85) : vHue < 1.5 ? vec3(1.0, 0.72, 0.25) : vec3(1.0, 0.95, 0.8);
        float pulse = smoothstep(0.08, 0.0, abs(fract(vU * 2.0 - uTime * 0.35 + vSeed) - 0.5) - 0.42);
        float lit = smoothstep(uReveal + 6.0, uReveal - 6.0, vX);                  // the light front sweeps left to right with your scroll
        float a = (0.18 + 0.5 * lit + pulse * (0.4 + 1.2 * lit));
        gl_FragColor = vec4(c * a, 1.0);
      }`,
  });
  const net = new THREE.Mesh(geo, mat); net.userData.noInk = true; net.frustumCulled = false; g.add(net);
  // crystals and seeds buried in the soil
  for (let i = 0; i < 40; i++) { const s = glowSprite(['#4ff0d0', '#ffb04a', '#fff0c0', '#ffd25a'][i % 4], 1 + r() * 2.5, 0.8); s.position.set((r() - 0.5) * 140, (r() - 0.5) * 66, -9.4); g.add(s); }
  // the clearing's roots coming down from above
  for (let i = 0; i < 6; i++) {
    const x = -14 + i * 5.6, pts = [new THREE.Vector3(x, 34.5, -9.5)]; let y = 34.5, xx = x;
    while (y > 8) { y -= 5; xx += (r() - 0.5) * 4; pts.push(new THREE.Vector3(xx, y, -9.5)); }
    const rt = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.7 - i * 0.05, 6), toon(tone('#1a1006', '#3a2410', '#6a4a24'), { rim: 0.3 })); g.add(rt);
  }
  return { group: g, mat };
}

/* ---------------------------------------------------------------- the giant tree and its project pods */
function podMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uGlow: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vN, vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; vY = position.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uGlow, uTime; varying vec3 vN, vV; varying float vY;
      void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float bands = 0.75 + 0.25 * sin(vY * 9.0 - uTime * 2.0);
        float a = (0.18 + pow(f, 1.8) * 0.95) * bands * uGlow; gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.15) * a, 1.0); }`,
  });
}
function makeGiant(projects) {
  const g = new THREE.Group(); g.position.copy(TREE);
  const bark = toon(tone('#140e0a', '#2a1e14', '#4a3624'), { rim: 0.15 });
  const trunk = new THREE.CylinderGeometry(3.4, 7, 56, 18, 20), tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i), a = Math.atan2(tp.getZ(i), tp.getX(i)); const k = 1 + Math.sin(a * 5 + y * 0.2) * 0.08; tp.setX(i, tp.getX(i) * k + Math.sin(y * 0.08) * 1.5); tp.setZ(i, tp.getZ(i) * k); }
  trunk.computeVertexNormals(); trunk.translate(0, 28, 0);
  g.add(new THREE.Mesh(trunk, bark));
  // glowing veins spiralling up the bark
  const veinPts = [];
  for (let v = 0; v < 6; v++) for (let k = 0; k < 60; k++) { const y = (k / 60) * 52, a = v * 1.05 + y * 0.09, rr = 7 - (y / 56) * 3.6 + 0.15; veinPts.push(new THREE.Vector3(Math.cos(a) * rr + Math.sin(y * 0.08) * 1.5, y, Math.sin(a) * rr)); }
  const veinGeo = new THREE.BufferGeometry().setFromPoints(veinPts);
  const veins = new THREE.Points(veinGeo, new THREE.PointsMaterial({ color: '#ffd25a', size: 0.35, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); veins.userData.noInk = true; g.add(veins);
  for (let i = 0; i < 6; i++) {                                                                  // buttress roots
    const a = (i / 6) * PI * 2, root = new THREE.Mesh(new THREE.ConeGeometry(1.8, 12, 7), bark);
    root.position.set(Math.cos(a) * 6, 3, Math.sin(a) * 6); root.rotation.set(Math.sin(a) * 1.05, 0, -Math.cos(a) * 1.05); g.add(root);
  }
  const leafT = tone('#082010', '#12401c', '#2a7a34');
  for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2, c = new THREE.Mesh(new THREE.SphereGeometry(9 + (i % 3) * 3, 16, 12), toon(leafT, { rim: 0.25 })); c.scale.set(1.3, 0.42, 1.3); c.position.set(Math.cos(a) * 12, 58 + (i % 2) * 4, Math.sin(a) * 12); g.add(c); }
  for (let i = 0; i < 7; i++) {                                                                  // branches reaching out over the pods
    const a = (i / 7) * PI * 2 + 0.3, br = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 18, 7), bark);
    br.position.set(Math.cos(a) * 8, 52, Math.sin(a) * 8); br.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); g.add(br);
  }
  // the pods: one per project, hanging on vines around the trunk; the ring turns
  const ring = new THREE.Group(); ring.position.y = 0; g.add(ring);
  const podCols = ['#4ff0d0', '#ffb04a', '#fff0a0', '#ff7a4a', '#5ad8ff', '#c8ff7a'];
  const pods = projects.map((pr, i) => {
    const a = (i / projects.length) * PI * 2, R = 15 + (i % 2) * 2.5, y = 40 + Math.sin(i * 1.7) * 3;
    const holder = new THREE.Group(); holder.position.set(Math.cos(a) * R, y, Math.sin(a) * R); ring.add(holder);
    const vine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 55 - y, 0)]), new THREE.LineBasicMaterial({ color: podCols[i % 6], transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, fog: false }));
    vine.userData.noInk = true; holder.add(vine);
    const pod = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16), podMaterial(podCols[i % 6])); pod.scale.set(1, 1.5, 1); pod.position.y = -1.6; pod.userData.noInk = true; holder.add(pod);
    const core = glowSprite(podCols[i % 6], 4.5, 0.9); core.position.y = -1.6; holder.add(core);
    const seed = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), glowMat('#ffffff', 0.9)); seed.position.y = -1.6; seed.userData.noInk = true; holder.add(seed);
    return { holder, pod, core, seed, color: podCols[i % 6], slug: pr.slug, hover: 0 };
  });
  return { group: g, ring, pods };
}

/* ---------------------------------------------------------------- the river of light */
function makeRiver() {
  const N = 400, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const z = RIVER.z0 - (i / N) * (RIVER.z0 - RIVER.z1), x = riverX(z), dx = riverX(z - 0.5) - riverX(z + 0.5);
    const w = 3 + Math.sin(i * 0.05) * 0.8, nx = 1 / Math.hypot(1, dx), nz = dx * nx;
    pos.push(x - nx * w, 0.05 + groundAt(x, z) * 0 - 0.3, z - nz * w, x + nx * w, -0.25, z + nz * w); uv.push(0, i / N, 1, i / N);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    fog: false, uniforms: { uTime: { value: 0 }, uSpeed: { value: 1 }, uNight: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying float vD, vZ; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vZ = w.z; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform float uTime, uSpeed, uNight; varying vec2 vUv; varying float vD, vZ; ${NOISE}
      void main() {
        float across = abs(vUv.x - 0.5) * 2.0;
        float flow = fbm(vec2(vUv.x * 5.0, vUv.y * 220.0 - uTime * 2.0 * uSpeed));
        float streak = smoothstep(0.55, 0.85, fbm(vec2(vUv.x * 9.0 + 3.0, vUv.y * 420.0 - uTime * 4.0 * uSpeed)));
        // day: clear turquoise water with sun glints
        vec3 water = mix(vec3(0.05, 0.42, 0.5), vec3(0.3, 0.88, 0.85), flow * 0.7) + vec3(1.0, 0.95, 0.8) * streak * 0.7;
        water += vec3(0.6, 1.0, 0.9) * smoothstep(0.8, 1.0, across) * 0.35;
        // night: turquoise light, and past the lava line, molten rock with a dark crust
        vec3 glowW = mix(vec3(0.02, 0.12, 0.14), vec3(0.2, 1.0, 0.85), flow * 0.8) + vec3(0.8, 1.0, 0.95) * streak * 0.9;
        float crust = smoothstep(0.42, 0.62, fbm(vec2(vUv.x * 7.0, vUv.y * 160.0 - uTime * 0.6 * uSpeed)));
        vec3 lava = mix(vec3(1.0, 0.42, 0.06) + vec3(1.0, 0.85, 0.3) * streak, vec3(0.08, 0.03, 0.02), crust * 0.85);
        float molten = smoothstep(-260.0, -330.0, vZ) * uNight;
        vec3 night = mix(glowW, lava, molten);
        vec3 c = mix(water, night, uNight);
        c *= 1.0 - smoothstep(70.0, 200.0, vD) * 0.7;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, m); mesh.userData.noInk = true; mesh.frustumCulled = false;
  return mesh;
}

/* ---------------------------------------------------------------- sets for the later sections */
export const STOPS = { stump: new THREE.Vector3(-46, 0, -372), crystals: new THREE.Vector3(22, 0, -462), fire: new THREE.Vector3(-24, 0, -532) };
function makeStops() {
  const g = new THREE.Group(), r = rng(31);
  // the old tree, cut: a wide stump whose face shows glowing growth rings
  const st = STOPS.stump, bark = toon(tone('#140e0a', '#2a1e14', '#4a3624'), { rim: 0.15 });
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(9, 10.5, 4, 32), bark); stump.position.set(st.x, groundAt(st.x, st.z) + 1.6, st.z); g.add(stump);
  const face = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.ShaderMaterial({
    fog: false, uniforms: { uTime: { value: 0 }, uDraw: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime, uDraw; varying vec2 vUv;
      void main(){ vec2 p = vUv - 0.5; float d = length(p) * 2.0, a = atan(p.y, p.x);
        float rings = smoothstep(0.08, 0.0, abs(fract(d * 9.0 + sin(a * 3.0) * 0.05) - 0.5) - 0.42);
        vec3 wood = mix(vec3(0.16, 0.09, 0.05), vec3(0.3, 0.18, 0.09), d);
        float lit = step(d, uDraw);
        vec3 glowc = mix(vec3(1.0, 0.75, 0.25), vec3(0.3, 1.0, 0.85), d);
        vec3 c = wood + rings * (0.08 + lit * glowc * (0.7 + 0.3 * sin(uTime * 2.0 - d * 8.0)));
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  face.rotation.x = -PI / 2; face.position.set(st.x, groundAt(st.x, st.z) + 3.62, st.z); face.userData.noInk = true; g.add(face);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2, root = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 6), bark); root.position.set(st.x + Math.cos(a) * 9, groundAt(st.x, st.z) + 0.8, st.z + Math.sin(a) * 9); root.rotation.set(Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3); g.add(root); }
  // the crystal cave mouth: crystals in clusters, all glowing
  const cr = STOPS.crystals, crystals = [];
  const cTones = [tone('#8a2a08', '#ff7a2a', '#ffd0a0'), tone('#8a5a08', '#ffc23a', '#fff0b0'), tone('#0a5a50', '#3fffd0', '#d0fff4'), tone('#7a1a10', '#ff4a2a', '#ffb090')];
  for (let i = 0; i < 46; i++) {
    const a = r() * PI * 2, d = 2 + r() * 14, h = 2 + Math.pow(r(), 1.5) * 9, w = 0.5 + r() * 1.2;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0, w, h, 6), toon(cTones[i % 4], { flat: 1, t1: -0.2, t2: 0.45, rim: 0.2 })); m.userData.flat = 1;
    const x = cr.x + Math.cos(a) * d, z = cr.z + Math.sin(a) * d * 0.6;
    m.position.set(x, groundAt(x, z) + h / 2 - 0.4, z); m.rotation.set((r() - 0.5) * 0.6, r() * 6, (r() - 0.5) * 0.6); g.add(m);
    const gl = glowSprite(['#ff8a3a', '#ffc23a', '#3fffd0', '#ff5a2a'][i % 4], h * 1.2, 0.35); gl.position.set(x, groundAt(x, z) + h * 0.6, z); g.add(gl);
    crystals.push({ m, h, gl });
  }
  // a blue campfire: flames, embers rising
  const fire = new THREE.Group(), fp = STOPS.fire; fire.position.set(fp.x, groundAt(fp.x, fp.z), fp.z); g.add(fire);
  for (let i = 0; i < 6; i++) { const log = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4, 7), bark); log.rotation.set(PI / 2 - 0.35, (i / 6) * PI * 2, 0); log.position.y = 0.6; fire.add(log); }
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(1.4 - i * 0.18, 4 + i * 0.6, 12, 1, true), glowMat(['#ff4a10', '#ff7a1a', '#ffa83a', '#ffd06a', '#fff4d0'][i], 0.42 - i * 0.04));
    f.position.y = 2.2 + i * 0.3; f.userData.noInk = true; fire.add(f); flames.push(f);
  }
  const fireGlow = glowSprite('#ff8a2a', 24, 0.65); fireGlow.position.y = 2.5; fire.add(fireGlow);
  const EM = 160, embers = glowPoints(EM, { fade: 120 }); const ep = [];
  { const C = embers.geometry.attributes.aColor.array, Z = embers.geometry.attributes.aSize.array; for (let i = 0; i < EM; i++) { ep.push([r() * PI * 2, r() * 1.5, r(), 0.6 + r() * 1.4]); C.set(r() < 0.6 ? [1, 0.55, 0.15] : [1, 0.85, 0.4], i * 3); Z[i] = 0.1 + r() * 0.2; } }
  fire.add(embers);
  const tick = (t, drawRings) => {
    face.material.uniforms.uTime.value = t; face.material.uniforms.uDraw.value = drawRings;
    flames.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 9 + i) * 0.08, 1 + Math.sin(t * 7 + i * 2) * 0.15, 1); f.rotation.y = t * (0.5 + i * 0.2); });
    fireGlow.material.opacity = 0.5 + Math.sin(t * 11) * 0.08;
    const P = embers.geometry.attributes.position.array;
    for (let i = 0; i < EM; i++) { const e = ep[i], u = (e[2] + t * 0.25 * e[3]) % 1; P[i * 3] = Math.cos(e[0] + u * 4) * (e[1] + u * 2); P[i * 3 + 1] = 1 + u * 14; P[i * 3 + 2] = Math.sin(e[0] + u * 4) * (e[1] + u * 2); }
    embers.geometry.attributes.position.needsUpdate = true;
  };
  return { group: g, tick, crystals, embers };
}

/* ---------------------------------------------------------------- the jungle: dense, layered, all of it glowing */
// keep plants off the camera's way: the clearing, the tree, the river, the later sets
function clearOfPath(x, z, pad = 0) {
  if (Math.hypot(x - 4, z + 4) < 15 + pad) return false;
  if (Math.hypot(x - TREE.x, z - TREE.z) < 12 + pad) return false;
  if (z < RIVER.z0 + 8 && z > RIVER.z1 - 8 && Math.abs(x - riverX(z)) < 4.5 + pad) return false;
  for (const s of Object.values(STOPS)) if (Math.hypot(x - s.x, z - s.z) < 13 + pad) return false;
  return true;
}
// a fern frond: an arching strip, wide in the middle
function frondGeo(L) {
  const g = new THREE.PlaneGeometry(1, 1, 2, 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, w = 0.55 * Math.pow(Math.sin(PI * v), 0.7) + 0.04;
    const notch = (Math.floor(v * 14) % 2) * 0.12 * Math.abs(u - 0.5) * 2;                     // serrated leaflets
    p.setXYZ(i, (u - 0.5) * w * (1 - notch), Math.sin(v * PI * 0.75) * L * 0.42 - v * v * L * 0.3, v * L);
  }
  g.computeVertexNormals();
  return g;
}
function blades(count, place, colors) {
  // glowing grass: instanced blades that sway; bright at the tips
  const base = new THREE.PlaneGeometry(0.07, 1, 1, 3); base.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
  const off = new Float32Array(count * 3), sc = new Float32Array(count * 2), col = new Float32Array(count * 3), c = new THREE.Color();
  for (let i = 0; i < count; i++) { const [x, y, z] = place(i); off.set([x, y, z], i * 3); sc.set([0.5 + Math.random() * 1.2, Math.random() * 6.28], i * 2); c.set(colors[i % colors.length]); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3)); geo.setAttribute('aSc', new THREE.InstancedBufferAttribute(sc, 2)); geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 3));
  geo.instanceCount = count;
  const m = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true, transparent: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 0 }, uCursor: { value: new THREE.Vector3(1e4, 0, 0) } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec3 aOff, aCol; attribute vec2 aSc; uniform float uTime; uniform vec3 uCursor; varying float vK; varying vec3 vC; varying float vNear;
      void main(){
        vec3 p = position; float h = aSc.x, k = p.y; p.y *= h;
        float c = cos(aSc.y), s = sin(aSc.y); p.xz = mat2(c, -s, s, c) * p.xz;
        vec2 d = aOff.xz - uCursor.xz; float near = smoothstep(7.0, 0.0, length(d));
        vec2 bend = vec2(sin(uTime * 1.3 + aOff.x * 0.3 + aOff.z * 0.2), cos(uTime * 1.1 + aOff.z * 0.25)) * 0.22 + normalize(d + 0.0001) * near * 1.2;
        p.xz += bend * k * k * h;
        vK = k; vC = aCol; vNear = near;
        vec4 mvPosition = viewMatrix * vec4(aOff + p, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uNight; uniform vec3 uGrade; varying float vK; varying vec3 vC; varying float vNear;
      void main(){ vec3 base = mix(vec3(0.03, 0.07, 0.03), vec3(0.09, 0.2, 0.07), vK) * uGrade; vec3 c = base + vC * smoothstep(0.72, 1.0, vK) * (0.12 + uNight * 0.9 + vNear * 1.4); gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  m.uniforms.uGrade = GRADE;
  const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.userData.noInk = true;
  return mesh;
}
function makeIsland(seed, size) {
  const g = new THREE.Group(), r = rng(seed);
  let geo = new THREE.ConeGeometry(size, size * 2.4, 14, 10); geo.rotateX(PI); geo.translate(0, -size * 1.2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + (fbm(a * 2 + seed, y * 0.08, 3) - 0.5) * 0.6; p.setXYZ(i, x * k, y, z * k); }
  geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, toon(tone('#1e1814', '#3a3028', '#6a5a48'), { flat: 1, rim: 0.12 })); rock.userData.flat = 1; g.add(rock);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(size * 1.05, size * 0.98, size * 0.25, 16), toon(tone('#0a2410', '#154a1c', '#2e8a36'), { rim: 0.2 })); top.position.y = size * 0.05; g.add(top);
  const crownT = tone('#082010', '#14441c', '#2f8a38');
  for (let i = 0; i < 6 + size / 2; i++) { const a = r() * PI * 2, d = r() * size * 0.85, cr = new THREE.Mesh(new THREE.SphereGeometry(size * (0.18 + r() * 0.16), 10, 8), toon(crownT, { rim: 0.25 })); cr.scale.y = 0.7; cr.position.set(Math.cos(a) * d, size * 0.2 + r() * size * 0.15, Math.sin(a) * d); g.add(cr); }
  // a waterfall pouring off the edge, and vines trailing under the rock
  const fallH = size * 6, fall = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.35, fallH, 1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime; varying vec2 vUv; ${NOISE}
      void main(){ float s = fbm(vec2(vUv.x * 6.0, vUv.y * 14.0 + uTime * 1.6)); float edge = sin(3.14159 * vUv.x);
        float a = (0.3 + s * 0.9) * edge * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.9, vUv.y); gl_FragColor = vec4(vec3(0.65, 0.92, 1.0) * a * 0.85, 1.0); }`,
  }));
  const ea = r() * PI * 2; fall.position.set(Math.cos(ea) * size * 1.02, size * 0.1 - fallH / 2, Math.sin(ea) * size * 1.02); fall.rotation.y = -ea + PI / 2; fall.userData.noInk = true; g.add(fall);
  const mist = glowSprite('#bfefff', size * 4, 0.3); mist.position.set(fall.position.x, -fallH + size * 0.3, fall.position.z); g.add(mist);
  const vp = [];
  for (let i = 0; i < 30; i++) { const a = r() * PI * 2, d = r() * size * 0.7, len = size * (0.8 + r() * 1.8), x = Math.cos(a) * d, z = Math.sin(a) * d, y0 = -size * 0.4 - r() * size * 0.6; vp.push(new THREE.Vector3(x, y0, z), new THREE.Vector3(x + (r() - 0.5), y0 - len, z)); }
  const vines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(vp), new THREE.LineBasicMaterial({ color: '#2f6a34', fog: true })); vines.userData.noInk = true; g.add(vines);
  g.userData.fall = fall;
  return g;
}

function addJungle(W, scene) {
  const r = rng(404);
  // walls of giant trunks on both sides, layered in depth
  const trunkGeo = new THREE.CylinderGeometry(0.75, 1, 1, 12, 1); trunkGeo.translate(0, 0.5, 0);
  // bark with bioluminescent markings: spots, spiral stripes and rings of moss that breathe
  const bark = new THREE.ShaderMaterial({
    fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 0 } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vW, vN; varying vec2 vUv;
      void main(){ vUv = uv; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime, uNight; uniform vec3 uGrade; varying vec3 vW, vN; varying vec2 vUv; ${NOISE}
      void main(){
        float l = dot(normalize(vN), normalize(vec3(-0.45, 0.8, 0.35)));
        vec3 c = mix(vec3(0.05, 0.035, 0.025), vec3(0.13, 0.09, 0.06), smoothstep(-0.2, 0.6, l)) * uGrade;
        c = mix(c, vec3(0.08, 0.16, 0.06) * uGrade, smoothstep(0.55, 0.75, vn(vW.xy * 0.3 + vW.z * 0.1)) * 0.7);   // moss
        float a = atan(vN.z, vN.x);
        float stripe = smoothstep(0.92, 1.0, sin(a * 3.0 + vW.y * 0.35 + vW.x * 0.1));
        float spots = smoothstep(0.78, 0.86, vn(vec2(a * 4.0, vW.y * 0.9) + vW.xz * 0.05));
        float ring = smoothstep(0.9, 1.0, sin(vW.y * 0.5 + vW.x)) * step(vW.y, 18.0);
        float breathe = 0.6 + 0.4 * sin(uTime * 1.3 + vW.x * 0.2 + vW.y * 0.15);
        vec3 hue = mix(vec3(0.2, 1.0, 0.85), vec3(0.3, 0.8, 1.0), vn(vW.xz * 0.02));
        c += hue * (stripe * 0.55 + spots * 0.9 + ring * 0.5) * breathe * (1.0 - smoothstep(10.0, 55.0, vW.y)) * uNight;
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  bark.uniforms.uGrade = GRADE;
  W.bark = bark;
  const TR = 220, trunks = new THREE.InstancedMesh(trunkGeo, bark, TR), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Pp = new THREE.Vector3(), E = new THREE.Euler();
  const trunkSpots = [];
  for (let i = 0, n = 0; i < 6000 && n < TR; i++) {
    const x = (r() - 0.5) * 300, z = 40 - r() * 600; if (!clearOfPath(x, z, 10)) continue;
    const rad = 1.4 + r() * 3.2, h = 46 + r() * 14;
    E.set((r() - 0.5) * 0.08, r() * 6, (r() - 0.5) * 0.08); Q.setFromEuler(E); S.set(rad, h, rad); Pp.set(x, groundAt(x, z) - 1, z);
    M.compose(Pp, Q, S); trunks.setMatrixAt(n, M); trunkSpots.push([x, z, rad, h]); n++;
  }
  scene.add(trunks);
  // a canopy closing overhead: hundreds of tree crowns in three greens, bumpy like a real forest roof
  const leafGeo = new THREE.IcosahedronGeometry(1, 2);
  const crownTones = [tone('#051408', '#0c2a10', '#1c5a20'), tone('#061810', '#0e3320', '#21663c'), tone('#0e1606', '#22300c', '#4a6218')];
  crownTones.forEach((tn, k) => {
    const CN = 340, canopy = new THREE.InstancedMesh(leafGeo, toon(tn, { rim: 0.18, t1: 0.05, t2: 0.62 }), CN);
    let n = 0;
    for (let i = 0; i < 4000 && n < CN; i++) {
      let x = (r() - 0.5) * 360, z = 60 - r() * 660;
      if (Math.hypot(x, z + 500) < 50) continue;                                                   // a gap where you look up at the stars
      if (Math.hypot(x - 6, z + 4) < 30) continue;                                                 // the hole you drop through into the clearing
      const rr = 7 + r() * 9; E.set(0, r() * 6, 0); Q.setFromEuler(E); S.set(rr * (1 + r() * 0.4), rr * (0.55 + r() * 0.3), rr * (1 + r() * 0.4)); Pp.set(x, 50 + r() * 16 + Math.sin(x * 0.05) * 4, z);
      M.compose(Pp, Q, S); canopy.setMatrixAt(n++, M);
    }
    canopy.count = n; scene.add(canopy);
  });
  // a few heavy vines drooping between the trunks
  const vineCols = ['#3fffd0', '#ffc23a', '#5ad8ff', '#ff8a3a'];
  const vineParts = [];
  for (let i = 0; i < 70; i++) {
    const t1 = trunkSpots[Math.floor(r() * trunkSpots.length)], t2 = trunkSpots[Math.floor(r() * trunkSpots.length)];
    if (Math.hypot(t1[0] - t2[0], t1[1] - t2[1]) > 40 || t1 === t2) continue;
    const y = 18 + r() * 24, a = new THREE.Vector3(t1[0], y, t1[1]), b = new THREE.Vector3(t2[0], y + (r() - 0.5) * 6, t2[1]);
    const mid = a.clone().lerp(b, 0.5); mid.y -= 6 + r() * 8;
    vineParts.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, 0.18 + r() * 0.2, 5));
  }
  if (vineParts.length) scene.add(new THREE.Mesh(mergeGeometries(vineParts), toon(tone('#0a1a0a', '#18361a', '#2e6a30'), { rim: 0.3 })));
  // ferns everywhere, three kinds; their tips glow
  const fronds = [frondGeo(3.4)], fernTones = [tone('#08200c', '#134a1a', '#2f8a34'), tone('#062420', '#0e4a3e', '#22907a'), tone('#1e1c06', '#3e3a0e', '#7a7420')];
  const tipPos = [], tipCol = [];
  fernTones.forEach((tn, k) => {
    const COUNT = 2600, ferns = new THREE.InstancedMesh(fronds[0], toon(tn, { side: THREE.DoubleSide, rim: 0.25, t1: -0.1, t2: 0.55 }), COUNT);
    let n = 0;
    for (let i = 0; i < 9000 && n < COUNT; i++) {
      const cx = (r() - 0.5) * 260, cz = 36 - r() * 590; if (!clearOfPath(cx, cz, 1.5)) continue;
      const fronds = 7, sc = 0.6 + r() * 1.6, y = groundAt(cx, cz) - 0.1;
      for (let f = 0; f < fronds && n < COUNT; f++) {
        const a = (f / fronds) * PI * 2 + r() * 0.5;
        E.set(-0.15 - r() * 0.35, a, 0, 'YXZ'); Q.setFromEuler(E); S.setScalar(sc * (0.8 + r() * 0.4)); Pp.set(cx, y, cz);
        M.compose(Pp, Q, S); ferns.setMatrixAt(n, M); n++;
        if (f % 2 === 0) { const tip = new THREE.Vector3(0, 0.15 * 3.4, 3.4).applyEuler(E).multiplyScalar(S.x).add(Pp); tipPos.push(tip); tipCol.push(vineCols[(k + f) % 4]); }
      }
    }
    ferns.count = n; scene.add(ferns);
  });
  const tips = glowPoints(tipPos.length, { fade: 120 });
  { const P = tips.geometry.attributes.position.array, C = tips.geometry.attributes.aColor.array, Z = tips.geometry.attributes.aSize.array, c = new THREE.Color();
    tipPos.forEach((p, i) => { P.set([p.x, p.y, p.z], i * 3); c.set(tipCol[i]).multiplyScalar(0.7 + r() * 0.5); C.set([c.r, c.g, c.b], i * 3); Z[i] = 0.12 + r() * 0.16; }); }
  scene.add(tips);
  // glowing grass carpeting the floor
  const grass = blades(42000, () => { let x, z; do { x = (r() - 0.5) * 230; z = 36 - r() * 590; } while (!clearOfPath(x, z, 2.5)); return [x, groundAt(x, z) - 0.05, z]; }, ['#3fffd0', '#5ad8ff', '#ffc23a', '#3fffd0', '#ff8a3a']);
  scene.add(grass);
  // floating islands with waterfalls, up above the canopy line and far off
  const islands = [];
  [[-70, 112, -150, 22], [90, 130, -230, 30], [-150, 150, -330, 38], [40, 175, -380, 26], [-30, 140, -520, 46], [170, 110, -470, 28], [-200, 120, -560, 34], [10, 200, -260, 18], [130, 175, -120, 16], [-110, 190, -60, 14], [230, 150, -330, 24], [-260, 170, -260, 26]].forEach(([x, y, z, s], i) => {
    const isl = makeIsland(700 + i, s); isl.position.set(x, y, z); isl.rotation.y = r() * 6; scene.add(isl); islands.push({ isl, y, ph: r() * 6 });
  });
  // bioluminescent pools of light on the floor
  for (let i = 0; i < 90; i++) { let x, z; do { x = (r() - 0.5) * 220; z = 36 - r() * 580; } while (!clearOfPath(x, z, 0)); const pool = new THREE.Mesh(new THREE.CircleGeometry(2 + r() * 5, 24), glowMat(vineCols[i % 4], 0.12)); pool.userData.nightGlow = true; pool.rotation.x = -PI / 2; pool.position.set(x, groundAt(x, z) + 0.08, z); pool.userData.noInk = true; scene.add(pool); }
  W.grass = grass; W.islands = islands; W.points.push(tips);
  W.pools = []; scene.traverse((o) => { if (o.userData.nightGlow) W.pools.push(o); });
}

/* ---------------------------------------------------------------- sky: tropical day, amber dusk, fire-and-ash night */
function makeSkyDome() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uNight: { value: 0 }, uTime: { value: 0 }, uSun: { value: new THREE.Vector3(-0.35, 0.45, -0.82).normalize() }, uVolcano: { value: new THREE.Vector3(0.15, 0.02, -1).normalize() } },
    vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uNight, uTime; uniform vec3 uSun, uVolcano; varying vec3 vP; ${NOISE}
      void main(){
        float h = vP.y, sd = max(0.0, dot(vP, uSun));
        vec3 day = mix(vec3(0.7, 0.84, 0.8), vec3(0.36, 0.64, 0.8), smoothstep(0.0, 0.35, h));
        day = mix(day, vec3(0.16, 0.4, 0.7), smoothstep(0.35, 0.9, h));
        day += vec3(1.0, 0.85, 0.55) * (pow(sd, 10.0) * 0.35 + pow(sd, 600.0) * 2.0);
        float cl = smoothstep(0.5, 0.75, fbm(vP.xz / (h + 0.25) * 1.6 + uTime * 0.004)) * smoothstep(0.02, 0.2, h);
        day = mix(day, vec3(0.95, 0.96, 0.92), cl * 0.5);
        vec3 dusk = mix(vec3(1.0, 0.55, 0.28), vec3(0.75, 0.32, 0.4), smoothstep(0.0, 0.3, h));
        dusk = mix(dusk, vec3(0.18, 0.12, 0.3), smoothstep(0.3, 0.9, h)) + vec3(1.0, 0.6, 0.3) * pow(sd, 4.0) * 0.6;
        float vd = max(0.0, dot(vP, uVolcano));
        vec3 night = mix(vec3(0.12, 0.05, 0.04), vec3(0.03, 0.03, 0.06), smoothstep(0.0, 0.5, h));
        night += vec3(1.0, 0.32, 0.08) * pow(vd, 8.0) * 0.9 * smoothstep(0.3, -0.05, h);                 // the volcano's glow on the smoke
        float ash = fbm(vP.xz / (h + 0.3) * 1.2 - uTime * 0.01);
        night = mix(night, vec3(0.16, 0.08, 0.06), smoothstep(0.45, 0.8, ash) * smoothstep(0.0, 0.35, h) * 0.7);
        vec3 c = mix(day, dusk, smoothstep(0.15, 0.5, uNight) * (1.0 - smoothstep(0.55, 0.9, uNight)));
        c = mix(c, night, smoothstep(0.55, 0.95, uNight));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(820, 48, 24), m); sky.userData.noInk = true; sky.frustumCulled = false;
  return sky;
}

/* ---------------------------------------------------------------- a sea of mist lying on the canopy */
function mistLayer(y, size, seed, tint) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(tint) }, uAmp: { value: 1 }, uSeed: { value: seed } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform float uTime, uAmp, uSeed; uniform vec3 uColor; varying vec2 vUv; varying float vD; ${NOISE}
      void main(){ float n = fbm(vUv * 9.0 + vec2(uTime * 0.006, uSeed)); float a = smoothstep(0.5, 0.8, n) * smoothstep(0.5, 0.2, length(vUv - 0.5)) * smoothstep(30.0, 160.0, vD) * 0.45 * uAmp;
        gl_FragColor = vec4(uColor, a); }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m); mesh.rotation.x = -PI / 2; mesh.position.y = y; mesh.userData.noInk = true; mesh.frustumCulled = false;
  return mesh;
}

/* ---------------------------------------------------------------- gliders: winged creatures circling the islands */
function makeGlider(seed) {
  const g = new THREE.Group(), r = rng(seed);
  const skin = toon(tone('#0e2a2a', '#1f5a52', '#4aa890'), { rim: 0.3 }), wingT = toon(tone('#3a1206', '#a8461a', '#ff9a4a'), { side: THREE.DoubleSide, rim: 0.25 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skin); body.scale.set(0.5, 0.35, 2.4); g.add(body);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.4, 8), skin); head.rotation.x = PI / 2; head.position.z = 2.6; g.add(head);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 3.5, 6), skin); tail.rotation.x = -PI / 2; tail.position.z = -3.6; g.add(tail);
  const wings = [];
  for (const side of [1, -1]) {
    const sh = new THREE.Shape(); sh.moveTo(0, 1.2); sh.bezierCurveTo(2.5, 2.2, 5.5, 0.8, 7, -0.4); sh.bezierCurveTo(4.8, -0.8, 2.4, -1.4, 0, -1.4); sh.lineTo(0, 1.2);
    const geo = new THREE.ShapeGeometry(sh, 12); geo.rotateX(-PI / 2); if (side < 0) geo.scale(-1, 1, 1);
    const pivot = new THREE.Group(); pivot.position.x = side * 0.35; g.add(pivot);
    pivot.add(new THREE.Mesh(geo, wingT)); wings.push({ pivot, side });
    const stripe = glowSprite('#3fffd0', 1.4, 0.0); stripe.position.set(side * 4, 0.1, 0); pivot.add(stripe); wings[wings.length - 1].glow = stripe;
  }
  g.userData = { wings, ph: r() * 6 };
  return g;
}

/* ---------------------------------------------------------------- the fire-and-ash country past the lava line */
function makeVolcanic() {
  const g = new THREE.Group(), r = rng(66);
  const basalt = toon(tone('#0a0808', '#1a1614', '#3a302a'), { flat: 1, rim: 0.12 });
  // basalt columns in clusters
  const colGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1); colGeo.translate(0, 0.5, 0);
  const COLS = 420, cols = new THREE.InstancedMesh(colGeo, basalt, COLS); cols.userData.flat = 1;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Pp = new THREE.Vector3();
  let n = 0;
  for (let c = 0; c < 60 && n < COLS; c++) {
    const cx = (r() - 0.5) * 240, cz = LAVA_Z - 20 - r() * 240; if (!clearOfPath(cx, cz, 4)) continue;
    const k = 4 + Math.floor(r() * 8);
    for (let i = 0; i < k && n < COLS; i++) {
      const x = cx + (r() - 0.5) * 7, z = cz + (r() - 0.5) * 7, w = 0.8 + r() * 1.2, h = 2 + Math.pow(r(), 1.4) * 16;
      Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6); S.set(w, h, w); Pp.set(x, groundAt(x, z) - 0.5, z); M.compose(Pp, Q, S); cols.setMatrixAt(n++, M);
    }
  }
  cols.count = n; g.add(cols);
  // glowing cracks of lava across the ground
  const cracks = [];
  for (let i = 0; i < 70; i++) {
    let x = (r() - 0.5) * 220, z = LAVA_Z - r() * 250; if (!clearOfPath(x, z, 2)) continue;
    const pts = []; let a = r() * PI * 2;
    for (let k = 0; k < 7; k++) { pts.push(new THREE.Vector3(x, groundAt(x, z) + 0.06, z)); a += (r() - 0.5) * 1.2; x += Math.cos(a) * 2.5; z += Math.sin(a) * 2.5; }
    cracks.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.12 + r() * 0.15, 4));
  }
  const crackMat = new THREE.MeshBasicMaterial({ color: '#ff6a1a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const crackMesh = new THREE.Mesh(mergeGeometries(cracks), crackMat); crackMesh.userData.noInk = true; g.add(crackMesh);
  // lava pools
  const pools = [];
  for (let i = 0; i < 16; i++) {
    const x = (r() - 0.5) * 200, z = LAVA_Z - 20 - r() * 230; if (!clearOfPath(x, z, 4)) continue;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2 + r() * 4, 20), new THREE.MeshBasicMaterial({ color: '#ff5a10', transparent: true, opacity: 0, fog: false }));
    pool.rotation.x = -PI / 2; pool.position.set(x, groundAt(x, z) + 0.1, z); pool.userData.noInk = true; g.add(pool);
    const gl = glowSprite('#ff7a2a', 14, 0); gl.position.set(x, groundAt(x, z) + 2, z); g.add(gl); pools.push({ pool, gl });
  }
  // the volcano, far off, its crater glowing and lava running down
  const cone = new THREE.ConeGeometry(160, 150, 40, 8), cp = cone.attributes.position;
  for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i); const top = y > 60 ? (y - 60) * 0.35 : 0; const k = 1 + (fbm(Math.atan2(z, x) * 3, y * 0.03, 3) - 0.5) * 0.25; cp.setXYZ(i, x * k + (y > 60 ? x * 0.004 * top : 0), y - top * 0.6, z * k); }
  cone.computeVertexNormals();
  const volc = new THREE.Mesh(cone, toon(tone('#0e0a0a', '#221a18', '#44362e'), { flat: 1 })); volc.userData.flat = 1; volc.position.set(70, 50, -780); g.add(volc);
  const crater = glowSprite('#ff6a1a', 120, 0); crater.position.set(70, 125, -770); g.add(crater);
  const flowPts = [];
  for (let f = 0; f < 6; f++) { let a = r() * PI * 2, y = 118; const pts = []; while (y > 0) { const rad = (125 - y) * 1.05 + 6; pts.push(new THREE.Vector3(70 + Math.cos(a) * rad, y, -780 + Math.sin(a) * rad * 0.6 + 40)); y -= 10; a += (r() - 0.5) * 0.3; } flowPts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 1.6, 5)); }
  const flows = new THREE.Mesh(mergeGeometries(flowPts), new THREE.MeshBasicMaterial({ color: '#ff5a10', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); flows.userData.noInk = true; g.add(flows);
  // smoke over the crater
  const smoke = [];
  for (let i = 0; i < 14; i++) { const sm = glowSprite('#2a1a16', 80 + r() * 80, 0); sm.material.blending = THREE.NormalBlending; sm.position.set(70 + (r() - 0.5) * 60, 150 + i * 14, -790); g.add(sm); smoke.push(sm); }
  // ash falling, embers rising
  const ASH = 2200, ash = glowPoints(ASH, { fade: 110 }), EMB = 900, embers = glowPoints(EMB, { fade: 110 });
  const aP = ash.geometry.attributes.position.array, aC = ash.geometry.attributes.aColor.array, aZ = ash.geometry.attributes.aSize.array, aSeed = new Float32Array(ASH * 3);
  for (let i = 0; i < ASH; i++) { aSeed.set([(r() - 0.5) * 220, r() * 60, LAVA_Z + 30 - r() * 290], i * 3); aC.set([0.55, 0.5, 0.48], i * 3); aZ[i] = 0.1 + r() * 0.16; }
  const eP = embers.geometry.attributes.position.array, eC = embers.geometry.attributes.aColor.array, eZ = embers.geometry.attributes.aSize.array, eSeed = new Float32Array(EMB * 3);
  for (let i = 0; i < EMB; i++) { eSeed.set([(r() - 0.5) * 220, r() * 40, LAVA_Z + 20 - r() * 280], i * 3); eC.set(r() < 0.7 ? [1, 0.45, 0.1] : [1, 0.8, 0.3], i * 3); eZ[i] = 0.12 + r() * 0.2; }
  g.add(ash, embers);
  const tick = (t, night) => {
    crackMat.opacity = night * (0.75 + Math.sin(t * 2) * 0.15);
    pools.forEach((o, i) => { o.pool.material.opacity = 0.35 + night * 0.65; o.gl.material.opacity = night * (0.55 + Math.sin(t * 3 + i) * 0.1); });
    crater.material.opacity = 0.25 + night * 0.65; flows.material.opacity = 0.2 + night * 0.7;
    smoke.forEach((sm, i) => { sm.material.opacity = 0.5 * (0.4 + night * 0.6); sm.position.y = 150 + ((i * 14 + t * 3) % 196); });
    for (let i = 0; i < ASH; i++) { aP[i * 3] = aSeed[i * 3] + Math.sin(t * 0.3 + i) * 2; aP[i * 3 + 1] = 60 - ((60 - aSeed[i * 3 + 1] + t * (1.2 + (i % 5) * 0.3)) % 60); aP[i * 3 + 2] = aSeed[i * 3 + 2]; }
    for (let i = 0; i < EMB; i++) { eP[i * 3] = eSeed[i * 3] + Math.sin(t * 0.8 + i) * 1.5; eP[i * 3 + 1] = (eSeed[i * 3 + 1] + t * (2 + (i % 7) * 0.5)) % 40; eP[i * 3 + 2] = eSeed[i * 3 + 2]; }
    ash.geometry.attributes.position.needsUpdate = true; embers.geometry.attributes.position.needsUpdate = true;
  };
  return { group: g, tick, ash, embers };
}

/* ---------------------------------------------------------------- the floor: jungle green, giving way to black basalt past the lava line */
function makeFloor() {
  const geo = new THREE.PlaneGeometry(340, 640, 200, 320); geo.rotateX(-PI / 2);
  const p = geo.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color(), green = new THREE.Color('#162a10'), moss = new THREE.Color('#1e3a14'), ashC = new THREE.Color('#1a1614');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i) - 250, y = groundAt(x, z);
    p.setXYZ(i, x, y, z);
    c.copy(green).lerp(moss, fbm(x * 0.05, z * 0.05, 2)).lerp(ashC, THREE.MathUtils.smoothstep(-z, -LAVA_Z - 20, -LAVA_Z + 30));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.computeVertexNormals(); geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return new THREE.Mesh(geo, toon(tone('#0a1408', '#162a10', '#2c4a1a'), { vertexColors: true, t1: 0.2, t2: 0.75 }));
}

/* ---------------------------------------------------------------- BUILD */
export function buildGlow(projects) {
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog('#a8d8c4', 40, 420);
  const W = { scene, tick: [] }, r = rng(77);
  W.sky = makeSkyDome(); scene.add(W.sky);
  const starGroup = new THREE.Group(); starGroup.add(makeStars(900, { radius: 600, minY: -0.1, seed: 8 })); scene.add(starGroup); W.starGroup = starGroup; W.stars = starGroup.children[0];
  // a pale ringed giant and a small moon hang in the sky
  const giant = makeRingedPlanet({ radius: 120, bands: [tone('#4a7a8a', '#8ac8d0', '#d8f4f0'), tone('#3a6a7a', '#6aa8b8', '#b8e4e8'), tone('#4a7a8a', '#9ad4d8', '#e4fcf8'), tone('#5a8a7a', '#8ac0a8', '#cdeee0'), tone('#4a7a8a', '#8ac8d0', '#d8f4f0'), tone('#3a6a7a', '#6aa8b8', '#b8e4e8'), tone('#4a7a8a', '#9ad4d8', '#e4fcf8')], ring: tone('#8ab8b8', '#cfeeea', '#ffffff'), tilt: 0.25 });
  giant.position.set(-260, 230, -720); giant.rotation.set(0.35, 0.2, 0.3); giant.traverse((o) => { if (o.material) { o.material.fog = false; o.material.needsUpdate = true; } }); scene.add(giant); W.giant2 = giant;
  const moon = makePlanet({ radius: 22, tone: tone('#7a6a5a', '#c8b8a0', '#fff4e0'), seed: 2 }); moon.position.set(240, 260, -700); moon.material.fog = false; moon.material.needsUpdate = true; scene.add(moon);

  scene.add(makeFloor());
  W.bloom = makeBloom(); W.bloom.group.position.set(9, -0.4, -6); W.bloom.group.scale.setScalar(1.35); scene.add(W.bloom.group);
  W.roots = makeRoots(); scene.add(W.roots.group);
  W.giant = makeGiant(projects); scene.add(W.giant.group);
  W.river = makeRiver(); scene.add(W.river);
  W.stops = makeStops(); scene.add(W.stops.group);
  W.volcanic = makeVolcanic(); scene.add(W.volcanic.group);

  // fewer, bigger mushrooms: a ring round the clearing and groves along the way
  const shrooms = [];
  for (let i = 0, n = 0; i < 1400 && n < 46; i++) {
    const z = 30 - r() * 290, x = (r() - 0.5) * 200; if (!clearOfPath(x, z, 3)) continue;
    const big = n % 3 === 0, rr = big ? 3 + r() * 3.5 : 1 + r() * 1.6, hh = big ? 6 + r() * 7 : 1.6 + r() * 2.4, [ct, gc] = CAP[n % 4];
    const m = makeMushroom(rr, hh, ct, gc, 900 + n); m.position.set(x, groundAt(x, z) - 0.2, z); m.rotation.set((r() - 0.5) * 0.2, r() * 6, (r() - 0.5) * 0.2); scene.add(m); shrooms.push(m); n++;
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2, d = 18 + (i % 3) * 3, x = 4 + Math.cos(a) * d, z = -4 + Math.sin(a) * d; if (z > 14) continue;
    const [ct, gc] = CAP[i % 4], m = makeMushroom(1.3 + (i % 3) * 1.1, 2.2 + (i % 3) * 2.2, ct, gc, 1300 + i); m.position.set(x, groundAt(x, z) - 0.2, z); scene.add(m); shrooms.push(m);
  }
  W.shrooms = shrooms;
  // turquoise moss, gold pollen by day
  const MOSS = 5000, moss = glowPoints(MOSS, { fade: 140 });
  { const P = moss.geometry.attributes.position.array, C = moss.geometry.attributes.aColor.array, Z = moss.geometry.attributes.aSize.array, c = new THREE.Color();
    for (let i = 0; i < MOSS; i++) { const z = 30 - r() * 330, x = (r() - 0.5) * 220; P.set([x, groundAt(x, z) + 0.15, z], i * 3); c.set(['#3fffd0', '#5ad8ff', '#3fffd0', '#ffc23a'][i % 4]).multiplyScalar(0.35 + r() * 0.6); C.set([c.r, c.g, c.b], i * 3); Z[i] = 0.12 + r() * 0.24; } }
  scene.add(moss);
  const POL = 1200, pollen = glowPoints(POL, { drift: 1.4, fade: 110 });
  { const P = pollen.geometry.attributes.position.array, C = pollen.geometry.attributes.aColor.array, Z = pollen.geometry.attributes.aSize.array;
    for (let i = 0; i < POL; i++) { P.set([(r() - 0.5) * 200, 1 + r() * 26, 30 - r() * 330], i * 3); C.set(r() < 0.6 ? [1, 0.92, 0.6] : [0.7, 1, 0.9], i * 3); Z[i] = 0.12 + r() * 0.2; } }
  scene.add(pollen);
  W.moss = moss; W.pollen = pollen;
  W.points = [moss, pollen, W.bloom.spores, W.stops.embers, W.volcanic.ash, W.volcanic.embers];
  // the vista: a sea of mist on the canopy, gliders round the islands, sunbeams under the leaves
  W.mist = [mistLayer(72, 1400, 1.3, '#e8f6f0'), mistLayer(82, 1400, 7.1, '#f4fbf8'), mistLayer(64, 1200, 3.7, '#dff0ea')];
  W.mist.forEach((m) => scene.add(m));
  W.gliders = Array.from({ length: 7 }, (_, i) => { const gl = makeGlider(30 + i); gl.scale.setScalar(1.6 + (i % 3) * 0.5); scene.add(gl); return { g: gl, R: 60 + i * 22, y: 110 + (i % 3) * 22, c: new THREE.Vector3(-40 + (i % 3) * 40, 0, -220 - i * 30), sp: 0.12 + (i % 4) * 0.03, ph: i * 1.3 }; });
  W.rays = [];
  for (let i = 0; i < 18; i++) {
    const h = 70, geo = new THREE.PlaneGeometry(4 + r() * 8, h); geo.translate(0, -h / 2, 0);
    const ray = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    ray.position.set((r() - 0.5) * 140, 62, 20 - r() * 260); ray.rotation.set(0.35, r() * PI, 0.15); ray.userData.noInk = true; scene.add(ray); W.rays.push(ray);
  }
  addJungle(W, scene);
  return W;
}
