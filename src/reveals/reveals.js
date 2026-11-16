import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

const NAME = 'Shubh Jadiya';
const LETTERS = [...NAME].filter((c) => c !== ' ').length; // 11
const FONT_PX = 256; // SDF is built once at this size

// ------------------------------------------------------------------ SDF of the name
// Felzenszwalb & Huttenlocher exact Euclidean distance transform.
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
function edt2d(grid, w, h) {
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
}

function buildNameSDF() {
  const font = `600 ${FONT_PX}px "Bricolage Grotesque", sans-serif`;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const pad = Math.round(FONT_PX * 0.45);
  const tw = Math.ceil(ctx.measureText(NAME).width);
  const W = tw + pad * 2;
  const Hh = Math.round(FONT_PX * 1.25) + pad * 2;
  const baseline = pad + Math.round(FONT_PX * 0.95);
  c.width = W; c.height = Hh;
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(NAME, pad, baseline);
  const img = ctx.getImageData(0, 0, W, Hh).data;

  const INF = 1e20;
  const outside = new Float64Array(W * Hh), inside = new Float64Array(W * Hh);
  for (let i = 0; i < W * Hh; i++) {
    const on = img[i * 4] > 127;
    outside[i] = on ? 0 : INF;
    inside[i] = on ? INF : 0;
  }
  edt2d(outside, W, Hh);
  edt2d(inside, W, Hh);

  const spread = FONT_PX * 0.4;
  const data = new Uint8Array(W * Hh);
  for (let y = 0; y < Hh; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const sd = Math.sqrt(outside[i]) - Math.sqrt(inside[i]); // px, negative inside
      const enc = Math.min(1, Math.max(0, 0.5 + sd / (2 * spread)));
      data[(Hh - 1 - y) * W + x] = Math.round(enc * 255); // flip so row 0 is the bottom
    }
  }
  const tex = new THREE.DataTexture(data, W, Hh, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.unpackAlignment = 1; // rows are not 4-byte aligned
  tex.needsUpdate = true;

  // letter centres (px, from the left of the canvas)
  const letters = [];
  for (let i = 0; i < NAME.length; i++) {
    if (NAME[i] === ' ') continue;
    const x0 = pad + ctx.measureText(NAME.slice(0, i)).width;
    const cw = ctx.measureText(NAME[i]).width;
    letters.push({ cx: x0 + cw / 2, w: cw });
  }
  const m = ctx.measureText('S');
  return { tex, W, H: Hh, pad, baseline, spread, tw, letters, capPx: m.actualBoundingBoxAscent || FONT_PX * 0.72 };
}

// ------------------------------------------------------------------ shader
const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const frag = /* glsl */ `
precision highp float;
#define NL ${LETTERS}
varying vec2 vUv;
uniform sampler2D uSDF;
uniform vec4 uRect;       // xy: bottom-left in scene units, zw: size
uniform float uSpread;    // scene units represented by the SDF's 0..1 range / 2
uniform float uLX[NL];
uniform float uLW[NL];
uniform float uBase, uTop;
uniform float uAspect, uTime, uT;
uniform int uMode;
uniform vec2 uRes, uMouse;

#define HZ 0.1
const vec3 NAVY  = vec3(0.02, 0.025, 0.075);
const vec3 PLUM  = vec3(0.19, 0.045, 0.22);
const vec3 PINK  = vec3(1.0, 0.18, 0.45);
const vec3 AMBER = vec3(1.0, 0.62, 0.30);
const vec3 CREAM = vec3(1.0, 0.94, 0.86);

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float fill(float d, float b){ return 1.0 - smoothstep(-b, b, d); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0-h); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
float ease(float x){ x = clamp(x,0.0,1.0); return x*x*(3.0-2.0*x); }

float textSDF(vec2 p){
  vec2 uv = (p - uRect.xy) / uRect.zw;
  if(uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return uSpread;
  return (texture2D(uSDF, uv).r - 0.5) * 2.0 * uSpread;
}
int nearestLetter(float x){
  int li = 0; float best = 1e9;
  for(int i=0;i<NL;i++){ float dx = abs(x - uLX[i]); if(dx < best){ best = dx; li = i; } }
  return li;
}

// The night set: sky, stars, sun, pink horizon, glossy floor with the sun's reflection.
vec3 scene(vec2 p, vec2 sunP, float sunR){
  vec2 ps = p - uMouse*0.02;
  vec3 col;
  float above = smoothstep(HZ - sunR, HZ + sunR*0.6, sunP.y);
  if(p.y > HZ){
    float k = smoothstep(HZ, 1.0, ps.y);
    col = mix(PLUM, NAVY, pow(k, 0.6));
    vec2 g = floor(ps*55.0);
    float star = step(0.986, hash(g)) * (1.0 - smoothstep(0.0, 0.1, length(fract(ps*55.0)-0.5)));
    col += vec3(0.85,0.88,1.0) * star * (0.35 + 0.35*sin(uTime*1.7 + hash(g+7.0)*30.0)) * smoothstep(HZ+0.2, 0.9, ps.y);
    float sd = length(p - sunP) - sunR;
    vec3 sunCol = mix(PINK, AMBER, smoothstep(sunP.y - sunR, sunP.y + sunR, p.y));
    col += mix(PINK, AMBER, 0.45) * exp(-max(sd,0.0)*5.5) * 0.4;
    col = mix(col, sunCol + 0.12, fill(sd, 0.005));
  } else {
    float depth = HZ - p.y;
    col = mix(PLUM*0.38, NAVY*0.45, smoothstep(0.0, 1.0, depth));
    float dx = p.x - sunP.x;
    float refl = exp(-dx*dx/(sunR*sunR)*1.1) * exp(-depth*1.3) * above;
    float ripple = 0.55 + 0.45*sin(depth*80.0/(depth+0.12) - uTime*1.4);
    col += mix(PINK, AMBER, 0.5) * refl * ripple * 0.5;
    col += PINK * 0.05 * smoothstep(0.93, 1.0, sin(depth*130.0/(depth+0.1))) * exp(-depth*2.5);
    col += PINK * exp(-depth*9.0) * 0.35;
  }
  col += PINK * (exp(-abs(p.y-HZ)*16.0)*0.8 + exp(-abs(p.y-HZ)*2.4)*0.16);
  // out-of-focus dark shape, bottom right foreground
  vec2 fp = p + uMouse*0.06 - vec2(uAspect*0.95, -1.05);
  col *= 1.0 - 0.75*fill(length(fp/vec2(0.7,0.45)) - 1.0, 0.25);
  return col;
}

void main(){
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
  float t = uT;
  vec2 sunRest = vec2(0.36*uAspect, 0.46);
  float R = 0.15;
  vec2 sunP = sunRest;
  float sunR = R;
  int li = nearestLetter(p.x);
  float dT = textSDF(p);
  float midY = (uBase + uTop) * 0.5;
  vec3 col;

  if(uMode == 1){
    // ---------- the sun breaks into orbs that become letters
    float tS = 0.8, st = 0.085, fl = 0.95;
    float launched = clamp((t - tS) / (float(NL)*st + 0.25), 0.0, 1.0);
    float done = tS + float(NL)*st + fl;
    float regrow = ease((t - done - 0.2) / 1.4);
    float pulse = 1.0 + 0.06*sin(t*14.0) * smoothstep(0.2, 0.5, t) * (1.0 - smoothstep(tS-0.1, tS+0.1, t));
    sunR = R * mix(1.0 - 0.72*launched, 1.0, regrow) * pulse;
    col = scene(p, sunP, sunR);

    float d = 1e3; float mLi = 0.0;
    for(int i=0;i<NL;i++){
      float t0 = tS + float(i)*st;
      float s = clamp((t - t0) / fl, 0.0, 1.0);
      if(s <= 0.0) continue;
      vec2 target = vec2(uLX[i], midY);
      vec2 pos = vec2(mix(sunP.x, target.x, ease(s)), mix(sunP.y, target.y, s) + 0.34*4.0*s*(1.0-s));
      float land = t0 + fl;
      float tl = t - land;
      if(tl > 0.0) pos.y += abs(sin(tl*11.0)) * exp(-tl*5.5) * 0.05;
      float r = 0.052 * smoothstep(0.0, 0.18, s);
      float dc = length(p - pos) - r;
      float m = ease((t - land - 0.12) / 0.6);
      float di = (li == i) ? mix(dc, dT, m) : mix(dc, 0.5, m);
      if(li == i) mLi = m;
      d = smin(d, di, 0.022);
    }
    float heat = 1.0 - mLi;
    vec3 hot = mix(PINK, AMBER, clamp((p.y - uBase)/(uTop - uBase), 0.0, 1.0));
    col += mix(PINK, AMBER, 0.4) * exp(-max(d,0.0)*32.0) * (0.12 + 0.55*heat);
    col = mix(col, mix(CREAM, hot + 0.15, heat), fill(d, 0.0025));
  }
  else if(uMode == 3){
    // ---------- the sun passes behind the floor; light leaks through the letters
    float tA = 0.3, tB = 2.9, tC = 4.0;
    float x0 = uLX[0] - 0.4, x1 = uLX[NL-1] + 0.35;
    float kA = ease((t - tA) / (tB - tA));
    float kB = ease((t - tB) / (tC - tB));
    vec2 behind = vec2(mix(x0, x1, kA), midY + 0.01);
    sunP = mix(behind, sunRest, kB);
    sunP.y += 0.18 * sin(3.14159*kB);
    col = scene(p, sunP, sunR);

    float passed = smoothstep(-0.06, 0.12, behind.x - uLX[li]);
    float cool = smoothstep(tB - 0.2, tC + 0.4, t);
    float near = exp(-dot(p - sunP, p - sunP) * 7.0);
    vec3 slot = PLUM*0.25 + mix(PINK, AMBER, 0.55)*near*2.2 + CREAM*exp(-dot(p-sunP,p-sunP)*40.0)*1.2*(1.0-kB);
    vec3 letter = mix(slot, mix(PINK*0.9, AMBER, 0.35) + 0.2, passed * (1.0 - near*0.5));
    letter = mix(letter, CREAM, cool * passed);
    float inside = fill(dT, 0.0025);
    col += PINK * exp(-abs(dT)*70.0) * passed * (0.7 - 0.4*cool);   // backlit rim
    col = mix(col, letter, inside);

    // god rays streaming out of the letters, away from the sun
    float intensity = smoothstep(tA, tA+0.4, t) * (1.0 - smoothstep(tB - 0.4, tB + 0.6, t));
    if(intensity > 0.001){
      vec2 dir = sunP - p; float len = length(dir);
      vec2 stp = dir / max(len, 1e-4) * min(len, 0.8) / 24.0;
      vec2 q = p; float w = 1.0, rays = 0.0;
      for(int k=0;k<24;k++){ q += stp; rays += (1.0 - step(0.0, textSDF(q))) * w; w *= 0.95; }
      col += mix(PINK, AMBER, 0.5) * (rays/24.0) * intensity * exp(-len*1.2) * 2.4;
    }
  }
  else if(uMode == 6){
    // ---------- light through window blinds; the slats tilt open
    col = scene(p, sunP, sunR);
    vec2 dir = normalize(vec2(-0.32, 1.0));
    float period = 0.085;
    float s = dot(p, dir) / period;
    float idx = floor(s), f = fract(s);
    float topIdx = 1.15 / period;
    float start = 0.35 + (topIdx - idx) * 0.034;
    float o = ease((t - start) / 0.9);
    float g = mix(0.08, 1.04, o);
    float lit = 1.0 - smoothstep(g - 0.07, g, abs(f - 0.5)*2.0);
    float done = smoothstep(3.0, 3.7, t);
    float L = max(lit, done);
    col *= mix(0.25, 1.0, L);
    col += AMBER * 0.07 * lit * (1.0 - done);
    float a = fill(dT, 0.0025) * L;
    col += AMBER * exp(-max(dT,0.0)*40.0) * 0.25 * lit * (1.0 - done);
    col = mix(col, CREAM, a);
  }
  else {
    // ---------- molten light drips from the horizon and pools into the letters
    col = scene(p, sunP, sunR);
    col += PINK * exp(-abs(p.y - HZ)*28.0) * 0.6 * smoothstep(0.1, 0.5, t) * (1.0 - smoothstep(2.6, 4.2, t));
    float yTop = uTop + 0.01;
    float Ld = HZ - yTop;
    float d = 1e3, heatL = 0.0;
    for(int i=0;i<NL;i++){
      float fi = float(i);
      float st0 = 0.35 + fract(fi*0.618) * float(NL) * 0.1;
      float x = uLX[i] + (hash(vec2(fi, 2.0)) - 0.5) * uLW[i] * 0.5;
      float fall = clamp((t - st0) / 0.75, 0.0, 1.0);
      float tipY = HZ - Ld*fall*fall;
      float det = clamp((t - st0 - 0.85) / 0.45, 0.0, 1.0);
      float topY = HZ - Ld*det*det;
      float rr = 0.008 + 0.007*smoothstep(HZ, yTop, p.y);
      float dd = 1e3;
      if(fall > 0.0 && det < 1.0) dd = sdSeg(p, vec2(x, topY), vec2(x, tipY)) - rr;
      if(fall > 0.0 && fall < 1.0) dd = smin(dd, length(p - vec2(x, tipY)) - 0.018, 0.02);
      float lvl = ease((t - st0 - 0.7) / 0.65);
      float level = mix(uBase - 0.09, yTop + 0.02, lvl) + 0.01*sin(p.x*55.0 + t*9.0)*(1.0 - lvl);
      float dl = (li == i) ? max(dT, p.y - level) : 1e3;
      d = smin(d, smin(dd, dl, 0.03), 0.015);
      if(li == i) heatL = 1.0 - smoothstep(st0 + 1.4, st0 + 2.8, t);
    }
    float heat = mix(1.0, heatL, step(dT, 0.004));
    vec3 hot = mix(PINK, vec3(1.0, 0.82, 0.62), 0.3);
    col += PINK * exp(-max(d,0.0)*30.0) * 0.55 * heat;
    col = mix(col, mix(CREAM, hot + 0.1, heat), fill(d, 0.0025));
  }

  vec2 vq = (vUv - 0.5) * vec2(uAspect, 1.0);
  col *= 1.0 - 0.38*pow(clamp(length(vq)*0.9, 0.0, 1.0), 2.4);
  col = col / (1.0 + col*0.12);
  col += (hash(vUv*uRes + fract(uTime*11.0)*311.0) - 0.5) * 0.04;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

// ------------------------------------------------------------------ app
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
const intro = document.getElementById('intro');
const lines = [...intro.querySelectorAll('[data-line]')];
const buttons = [...document.querySelectorAll('[data-mode]')];

const u = {
  uSDF: { value: null },
  uRect: { value: new THREE.Vector4() },
  uSpread: { value: 0.1 },
  uLX: { value: new Float32Array(LETTERS) },
  uLW: { value: new Float32Array(LETTERS) },
  uBase: { value: -0.3 },
  uTop: { value: -0.1 },
  uAspect: { value: 1 },
  uTime: { value: 0 },
  uT: { value: 0 },
  uMode: { value: 1 },
  uRes: { value: new THREE.Vector2() },
  uMouse: { value: new THREE.Vector2() },
};
const scene = new THREE.Scene();
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: u })));
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

let sdf = null;

// Place the name lower-left in scene units, then put the intro right below it.
function layout() {
  const w = innerWidth, h = innerHeight, aspect = w / h;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h, false);
  u.uRes.value.set(renderer.domElement.width, renderer.domElement.height);
  u.uAspect.value = aspect;
  if (!sdf) return;

  const padPx = Math.max(18, Math.min(40, w * 0.03));
  const unitsPerPx = 2 / h;                       // CSS px -> scene units
  let em = Math.min(0.3, (2 * aspect - 2 * padPx * unitsPerPx) * 0.92 / (sdf.tw / FONT_PX)); // name font-size (scene units)
  const k = em / FONT_PX;                          // scene units per SDF px
  const left = -aspect + padPx * unitsPerPx - sdf.pad * k;
  const baseY = aspect < 0.9 ? -0.18 : -0.24;
  const bottom = baseY - (sdf.H - sdf.baseline) * k;
  u.uRect.value.set(left, bottom, sdf.W * k, sdf.H * k);
  u.uSpread.value = sdf.spread * k;
  u.uBase.value = baseY;
  u.uTop.value = baseY + sdf.capPx * k;
  sdf.letters.forEach((L, i) => { u.uLX.value[i] = left + L.cx * k; u.uLW.value[i] = L.w * k; });

  const descY = baseY - FONT_PX * 0.24 * k;       // below descenders
  intro.style.setProperty('--top', `${((1 - descY) / 2) * h + 12}px`);
}

// Per-mode intro animation, timed to land as the name finishes.
const introDelay = { 1: 2.6, 3: 3.1, 6: 2.5, 8: 2.9 };
function playIntro(mode) {
  intro.className = 'intro';
  lines.forEach((el) => { el.innerHTML = el.dataset.html ?? (el.dataset.html = el.innerHTML); el.style.animationDelay = ''; });
  void intro.offsetWidth; // restart CSS animations
  const base = introDelay[mode];
  if (mode === 8) {
    // split into characters so each one can drip in
    let n = 0;
    lines.forEach((el, li) => {
      const walk = (node) => {
        [...node.childNodes].forEach((ch) => {
          if (ch.nodeType === 3) {
            const frag = document.createDocumentFragment();
            [...ch.textContent].forEach((c) => {
              const s = document.createElement('span');
              s.className = 'ch'; s.textContent = c;
              s.style.animationDelay = `${base + li * 0.25 + (n++) * 0.012}s`;
              frag.appendChild(s);
            });
            node.replaceChild(frag, ch);
          } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
        });
      };
      walk(el);
    });
  } else {
    lines.forEach((el, i) => { el.style.animationDelay = `${base + i * 0.22}s`; });
  }
  intro.classList.add(`m${mode}`);
}

let mode = 1, tStart = performance.now();
function setMode(m) {
  mode = m;
  u.uMode.value = m;
  tStart = performance.now();
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.mode === m)));
  playIntro(m);
  history.replaceState(null, '', `#${m}`);
}
buttons.forEach((b) => b.addEventListener('click', () => setMode(+b.dataset.mode)));
document.getElementById('replay').addEventListener('click', () => setMode(mode));
addEventListener('keydown', (e) => {
  if (['1', '3', '6', '8'].includes(e.key)) setMode(+e.key);
  if (e.key === 'r' || e.key === 'R') setMode(mode);
});

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', (e) => {
  mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
  mouse.ty = -(e.clientY / innerHeight - 0.5) * 2;
}, { passive: true });
addEventListener('resize', layout);

let last = performance.now();
let frozen = null; // dev: window.__freeze(seconds) holds the timeline at one moment
if (import.meta.env.DEV) window.__freeze = (s, m) => { if (m) setMode(m); frozen = s; };
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  mouse.x += (mouse.tx - mouse.x) * (1 - Math.exp(-4 * dt));
  mouse.y += (mouse.ty - mouse.y) * (1 - Math.exp(-4 * dt));
  u.uTime.value = now / 1000;
  u.uT.value = frozen ?? (now - tStart) / 1000;
  u.uMouse.value.set(mouse.x, mouse.y);
  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}

document.fonts.load(`600 ${FONT_PX}px "Bricolage Grotesque"`).finally(() => {
  sdf = buildNameSDF();
  u.uSDF.value = sdf.tex;
  layout();
  const fromHash = +location.hash.slice(1);
  setMode([1, 3, 6, 8].includes(fromHash) ? fromHash : 1);
  requestAnimationFrame(frame);
});
layout();
