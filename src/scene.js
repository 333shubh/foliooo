import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

// Scene 00: a dark warm room, one spotlight, a little creature, and a neon name on the wall.
// Everything is 2D signed-distance shapes, lit and blurred in one fragment shader.

const vert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uName;
uniform vec2 uRes;
uniform float uAspect;
uniform float uTime;
uniform vec2 uMouse;     // smoothed, scene units
uniform float uLight;    // spotlight 0..1 (flickers on)
uniform float uSign;     // neon sign 0..1 (flickers on)
uniform float uScroll;   // 0..1
uniform float uBlink;    // 0 open .. 1 closed
uniform vec2 uLook;      // pupil direction -1..1
uniform float uSquash;   // -1..1
uniform float uHop;      // vertical offset
uniform float uIdea;     // bulb flare 0..1
uniform float uHover;    // 0..1
uniform float uWake;     // 0..1 creature visible

const vec3 CREAM = vec3(1.0, 0.93, 0.78);
const vec3 WARM  = vec3(1.0, 0.68, 0.38);
const vec3 RED   = vec3(0.92, 0.16, 0.14);
const vec3 GREEN = vec3(0.22, 0.52, 0.30);
const vec3 PINE  = vec3(0.05, 0.16, 0.09);
const vec3 WINE  = vec3(0.16, 0.03, 0.045);
const vec3 INK   = vec3(0.035, 0.01, 0.015);

const float FLOOR = -0.42;

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }

float sdEllipse(vec2 p, vec2 r){ float k = length(p/r); return (k-1.0)*min(r.x, r.y); }
float sdCircle(vec2 p, float r){ return length(p)-r; }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p)-b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
float fill(float d, float blur){ return 1.0 - smoothstep(-blur, blur, d); }

// tall arch: box with a round top
float sdArch(vec2 p, float w, float top){
  float box = sdBox(p - vec2(0.0, (top + FLOOR)*0.5), vec2(w, (top - FLOOR)*0.5));
  float cap = sdCircle(p - vec2(0.0, top), w);
  return min(box, cap);
}

void main(){
  vec2 uv = vUv;
  vec2 p0 = (uv - 0.5) * vec2(uAspect, 1.0) * 2.0;

  // camera: scroll pushes in toward the creature
  vec2 focus = vec2(0.0, FLOOR + 0.1);
  float zoom = 1.0 + uScroll*uScroll*7.0;
  vec2 p = focus + (p0 - focus) / zoom;
  vec2 m = uMouse;
  float t = uTime;
  float L = uLight;

  // ---------------- back wall ----------------
  vec2 pw = p - m*0.015;
  vec3 col = mix(WINE, INK, smoothstep(-0.3, 1.1, pw.y));
  // warm wash where the light spills
  col += WARM * 0.05 * L * exp(-dot(pw - vec2(0.0,-0.2), pw - vec2(0.0,-0.2))*1.4);

  // arches (far, soft)
  for(int i=-2;i<=2;i++){
    float fi = float(i);
    vec2 ap = pw - vec2(fi*0.78, 0.0);
    float w = 0.27;
    float d = sdArch(ap, w, 0.06);
    float a = fill(d, 0.025);
    float center = 1.0 - abs(fi)*0.32;
    vec3 inside = mix(PINE, GREEN, smoothstep(0.35, FLOOR, ap.y)) * (0.35 + 0.65*center);
    inside += CREAM * 0.12 * L * smoothstep(0.2, FLOOR, ap.y) * center;
    col = mix(col, inside, a*0.9);
    // soft green halo around each arch
    col += GREEN * 0.05 * exp(-max(d,0.0)*14.0) * center;
  }

  // ---------------- neon name ----------------
  vec2 nuv = pw / (vec2(uAspect, 1.0)*2.0) + 0.5;
  float n0 = texture2D(uName, nuv).r;
  float n3 = texture(uName, nuv, 3.0).r;
  float n5 = texture(uName, nuv, 5.0).r;
  float n7 = texture(uName, nuv, 7.0).r;
  float heat = exp(-dot(p - m, p - m)*3.0) * 0.8;   // the cursor warms the letters
  float S = uSign;
  col = mix(col, vec3(0.09,0.035,0.035), n0*(1.0-S)*0.7);       // unlit tube
  col += vec3(0.45,0.04,0.3) * n7 * 0.55 * S;                     // violet fringe
  col += RED  * n5 * (0.9 + heat) * S;
  col += WARM * n3 * (0.55 + heat*1.2) * S;
  col = mix(col, mix(CREAM, vec3(1.0), heat*0.6), n0*S);          // hot core

  // ---------------- floor ----------------
  float fy = FLOOR;
  if(p.y < fy){
    float k = smoothstep(fy, fy-0.9, p.y);
    col = mix(WINE*0.55, INK*0.6, k);
    // reflection of the arches: a faint green smear
    col += GREEN * 0.06 * exp(-abs(p.y-fy)*6.0) * (0.6+0.4*cos(p.x*4.0));
  }
  // horizon line
  col += CREAM * 0.18 * L * exp(-abs(p.y-fy)*120.0) * exp(-p.x*p.x*0.35);

  // ---------------- spotlight ----------------
  vec2 apex = vec2(0.0, 1.35) + m*0.03;
  vec2 rel = p - apex;
  float tanA = abs(rel.x) / max(-rel.y, 1e-3);
  float cone = (1.0 - smoothstep(0.24, 0.34, tanA)) * step(rel.y, 0.0) * step(fy-0.002, p.y);
  float coreBeam = 1.0 - smoothstep(0.0, 0.3, tanA);
  float dust = smoothstep(0.82, 1.0, noise(p*vec2(38.0, 30.0) + vec2(t*0.25, -t*0.6))) * 0.8;
  float beam = cone * (0.10 + 0.07*coreBeam + dust*0.12) * smoothstep(1.35, 0.6, p.y);
  col += CREAM * beam * L;

  // pool of light on the floor
  vec2 pp = (p - vec2(0.0, fy - 0.07)) / vec2(0.7, 0.12);
  float pool = exp(-dot(pp,pp)*1.6);
  col += WARM * pool * 0.55 * L * step(p.y, fy+0.004);
  col += CREAM * exp(-dot(pp,pp)*7.0) * 0.35 * L * step(p.y, fy+0.004);

  // ---------------- the creature ----------------
  vec2 c = vec2(0.0, fy + 0.095 + uHop);
  vec2 r = vec2(0.165, 0.095) * vec2(1.0 + uSquash*0.12, 1.0 - uSquash*0.14) * (1.0 + uHover*0.04);
  vec2 q = p - c;
  // shadow
  float shadowStretch = 1.0 + uHop*3.0;
  float sh = fill(sdEllipse(p - vec2(c.x, fy - 0.006), vec2(0.17*shadowStretch, 0.022)), 0.03);
  col *= 1.0 - sh*0.75*uWake;

  float bd = sdEllipse(q, r);
  float body = fill(bd, 0.004) * uWake;
  vec3 bc = vec3(0.045, 0.025, 0.03);
  float topLit = smoothstep(-0.2, 1.0, q.y / r.y);
  bc += CREAM * 0.55 * L * exp(-abs(bd)*70.0) * topLit;                // rim from the spotlight
  bc += GREEN * 0.18 * exp(-abs(bd)*50.0) * smoothstep(0.3, -1.0, q.y/r.y); // green bounce below
  float spec = fill(sdEllipse(q - vec2(-0.07, 0.055)*r/vec2(0.165,0.095), vec2(0.038, 0.014)), 0.012);
  bc += CREAM * spec * 0.5 * L;
  col = mix(col, bc, body);

  // eyes
  float open = 1.0 - uBlink;
  float eyeGrow = 1.0 + uHover*0.18 + uIdea*0.25;
  for(int s=-1;s<=1;s+=2){
    vec2 ec = c + vec2(float(s)*0.058, 0.012) * r/vec2(0.165,0.095);
    vec2 er = vec2(0.022, 0.027*open + 0.0015) * eyeGrow;
    float ed = sdEllipse(p - ec, er);
    float eye = fill(ed, 0.0025) * uWake;
    col += CREAM * 0.35 * exp(-max(ed,0.0)*45.0) * uWake * open;      // glow
    col = mix(col, CREAM*1.05, eye);
    vec2 pc = ec + uLook*vec2(0.009, 0.010)*eyeGrow;
    float pupil = fill(sdCircle(p - pc, 0.0105*eyeGrow), 0.002) * eye;
    col = mix(col, INK, pupil);
  }

  // antenna + idea bulb
  float sway = sin(t*1.7)*0.012 + uSquash*0.01;
  vec2 a0 = c + vec2(0.02, r.y*0.92);
  vec2 a1 = a0 + vec2(0.025 + sway, 0.085);
  float ant = fill(sdSeg(p, a0, a1) - 0.0035, 0.002) * uWake;
  col = mix(col, vec3(0.06,0.03,0.035) + CREAM*0.25*L, ant);
  float bulbR = 0.017 + uIdea*0.006;
  float bdist = length(p - a1);
  float pulse = 0.55 + 0.45*sin(t*2.2);
  vec3 bulbCol = mix(RED, CREAM, uIdea);
  float glowAmt = (0.35 + 0.25*pulse) + uIdea*2.2;
  col += bulbCol * exp(-bdist*(28.0 - uIdea*16.0)) * glowAmt * 0.5 * uWake;
  col = mix(col, mix(bulbCol, vec3(1.0), 0.35 + uIdea*0.5), fill(bdist - bulbR, 0.003) * uWake);
  // idea flash lights the whole room a touch
  col += WARM * uIdea * 0.08 * exp(-dot(p - a1, p - a1)*1.2);

  // ---------------- foreground (out of focus) ----------------
  vec2 pf = p0 + m*0.11;
  // pine silhouettes, bottom left
  float fl = 1e3;
  fl = min(fl, sdEllipse(pf - vec2(-uAspect*1.0 + 0.1, -0.95), vec2(0.65, 0.35)));
  fl = min(fl, sdEllipse(pf - vec2(-uAspect*1.0 - 0.15, -0.35), vec2(0.35, 0.6)));
  float fol = fill(fl, 0.14);
  vec3 fcol = PINE*0.35 + GREEN*0.05*smoothstep(-0.3, 0.3, pf.y);
  col = mix(col, fcol, fol*0.92);
  // red ornament, top right
  vec2 oc = vec2(uAspect*1.0 - 0.18, 0.62);
  float od = sdCircle(pf - oc, 0.3);
  float orn = fill(od, 0.09);
  vec3 ocol = RED*0.55 + CREAM*0.35*exp(-dot(pf-oc-vec2(-0.1,0.1), pf-oc-vec2(-0.1,0.1))*30.0);
  col = mix(col, ocol*(0.4+0.6*L), orn*0.85);
  // bokeh drifting up
  for(int i=0;i<7;i++){
    float fi = float(i);
    float sp = 0.03 + 0.02*hash(vec2(fi, 3.1));
    vec2 bc2 = vec2((hash(vec2(fi,1.7))-0.5)*2.0*uAspect, mod(hash(vec2(fi,9.2))*2.4 + t*sp, 2.4) - 1.2);
    bc2 += m*0.06*(0.5+hash(vec2(fi,4.4)));
    float br = 0.04 + 0.07*hash(vec2(fi,5.5));
    float bk = fill(sdCircle(p0 - bc2, br), br*0.6);
    vec3 bkc = mix(CREAM, RED, step(0.6, hash(vec2(fi,7.7))));
    col += bkc * bk * 0.06 * L;
  }

  // ---------------- finish ----------------
  col *= 1.0 - smoothstep(0.6, 1.0, uScroll)*0.85;            // fade as we enter
  vec2 vq = (uv - 0.5) * vec2(uAspect, 1.0);
  col *= 1.0 - 0.45*pow(clamp(length(vq)*0.95, 0.0, 1.0), 2.4);
  col = col / (1.0 + col*0.18);                                // gentle shoulder
  col += (hash(uv*uRes + fract(t*13.0)*317.0) - 0.5) * 0.045;  // grain
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export class Scene {
  constructor(canvas, name) {
    this.name = name;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    this.nameTex = new THREE.CanvasTexture(c);
    this.nameTex.generateMipmaps = true;
    this.nameTex.minFilter = THREE.LinearMipmapLinearFilter;
    this.nameTex.magFilter = THREE.LinearFilter;

    this.u = {
      uName: { value: this.nameTex },
      uRes: { value: new THREE.Vector2(1, 1) },
      uAspect: { value: 1 },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2() },
      uLight: { value: 0 },
      uSign: { value: 0 },
      uScroll: { value: 0 },
      uBlink: { value: 1 },
      uLook: { value: new THREE.Vector2() },
      uSquash: { value: 0 },
      uHop: { value: 0 },
      uIdea: { value: 0 },
      uHover: { value: 0 },
      uWake: { value: 0 },
    };
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: this.u })));
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.resize();
  }

  // Name drawn white-on-black at screen resolution; the shader turns it into neon.
  drawName() {
    const { width: w, height: h } = this.renderer.domElement;
    const c = this.nameTex.image;
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const font = (s) => `400 ${s}px "Anton", Impact, sans-serif`;
    const text = this.name.toUpperCase();
    const portrait = w / h < 0.85;
    if (!portrait) {
      let size = h * 0.2;
      ctx.font = font(size);
      const maxW = w * 0.74;
      const tw = ctx.measureText(text).width;
      if (tw > maxW) size *= maxW / tw;
      ctx.font = font(size);
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.02}px`;
      ctx.fillText(text, w / 2, h * 0.24);
    } else {
      const [a, b] = text.split(' ');
      const size = Math.min(w * 0.3, h * 0.13);
      ctx.font = font(size);
      ctx.fillText(a, w / 2, h * 0.22);
      ctx.fillText(b, w / 2, h * 0.22 + size * 1.0);
    }
    this.nameTex.needsUpdate = true;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h, false);
    const el = this.renderer.domElement;
    this.u.uRes.value.set(el.width, el.height);
    this.u.uAspect.value = w / h;
    this.drawName();
  }

  // Creature centre + size in CSS px (for hover/click).
  creatureScreen(hop = 0) {
    const h = innerHeight, aspect = innerWidth / h;
    const sx = 0, sy = -0.42 + 0.095 + hop;
    const x = (sx / (aspect * 2) + 0.5) * innerWidth;
    const y = (0.5 - sy / 2) * h;
    return { x, y, rx: (0.165 / (aspect * 2)) * innerWidth, ry: (0.095 / 2) * h };
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
