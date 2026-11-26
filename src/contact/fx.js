import * as THREE from 'three';
import { Stage } from '../ds/toon/stage.js';

/* ==========================================================================
   FXStage: the toon Stage, plus a cinematic finishing pass for SIGNAL.
   ink + colour (as Stage) → toon composite into rtPost → bloom (two blurred
   mips of the bright parts) → final: chromatic aberration, underwater wobble,
   water drops on the lens, a cursor torch in the deep, flash, vignette.
   All knobs live on stage.fx and are eased by the page each frame.
   ========================================================================== */

const VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BRIGHT = /* glsl */ `
  uniform sampler2D tIn; uniform float uThresh; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tIn, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(uThresh, uThresh + 0.3, l), 1.0);
  }`;
const BLUR = /* glsl */ `
  uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
  void main() {
    vec3 s = texture2D(tIn, vUv).rgb * 0.227027;
    s += (texture2D(tIn, vUv + uDir * 1.3846).rgb + texture2D(tIn, vUv - uDir * 1.3846).rgb) * 0.3162162;
    s += (texture2D(tIn, vUv + uDir * 3.2308).rgb + texture2D(tIn, vUv - uDir * 3.2308).rgb) * 0.0702703;
    gl_FragColor = vec4(s, 1.0);
  }`;
const FINAL = /* glsl */ `
  uniform sampler2D tIn, tB1, tB2;
  uniform vec2 uRes, uCursor; uniform vec3 uFlashCol;
  uniform float uTime, uBloom, uCA, uWater, uDrops, uFlash, uTorch, uVig, uLift;
  varying vec2 vUv;
  float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 uv = vUv;
    // under water the whole picture breathes
    uv += uWater * 0.0035 * vec2(sin(uv.y * 24.0 + uTime * 1.7), cos(uv.x * 19.0 + uTime * 1.3));
    // drops on the lens after breaking the surface: some cells hold a bead that bends the picture
    float drop = 0.0;
    if (uDrops > 0.002) {
      for (int k = 0; k < 2; k++) {
        float sc = k == 0 ? 7.0 : 13.0;
        vec2 g = vec2(uv.x * aspect, uv.y + uTime * 0.02 * float(k)) * sc;
        vec2 id = floor(g), f = fract(g) - 0.5;
        float hh = h1(id + float(k) * 9.1);
        vec2 o = (vec2(h1(id + 3.1), h1(id + 7.7)) - 0.5) * 0.55;
        float r = 0.1 + 0.2 * h1(id + 1.7);
        float d = length((f - o) * vec2(1.0, 0.8));
        float m = smoothstep(r, r * 0.55, d) * step(0.55, hh);
        uv -= (f - o) * m * 0.09 * uDrops / sc * 7.0;
        drop = max(drop, m * smoothstep(r * 0.2, r, d));
      }
    }
    vec2 dir = uv - 0.5;
    float ca = uCA * 0.007;
    vec3 col = vec3(texture2D(tIn, uv + dir * ca).r, texture2D(tIn, uv).g, texture2D(tIn, uv - dir * ca).b);
    vec3 bl = texture2D(tB1, uv).rgb * 0.9 + texture2D(tB2, uv).rgb * 1.2;
    col += bl * uBloom;
    // the torch: in the deep, your cursor is the only light
    vec2 dc = (vUv - uCursor) * vec2(aspect, 1.0);
    float torch = smoothstep(0.46, 0.0, length(dc));
    col *= mix(1.0, 0.38 + 1.0 * torch, uTorch);
    col += uFlashCol * uFlash;
    col += drop * uDrops * 0.12;
    float v = smoothstep(1.3, 0.3, length((vUv - 0.5) * vec2(aspect * 0.8, 1.0)));
    col *= mix(1.0, v, uVig);
    col = col * (1.0 + uLift) + uLift * 0.02;
    gl_FragColor = vec4(col, 1.0);
  }`;

export class FXStage extends Stage {
  constructor(canvas, opts = {}) {
    super(canvas, opts);
    const rt = () => new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    this.rtPost = rt(); this.rtA = rt(); this.rtB = rt(); this.rtC = rt(); this.rtD = rt();
    const mat = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
    this.mBright = mat(BRIGHT, { tIn: { value: null }, uThresh: { value: 0.82 } });
    this.mBlur = mat(BLUR, { tIn: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.mFinal = mat(FINAL, {
      tIn: { value: this.rtPost.texture }, tB1: { value: this.rtA.texture }, tB2: { value: this.rtC.texture },
      uRes: { value: new THREE.Vector2(1, 1) }, uCursor: { value: new THREE.Vector2(0.5, 0.5) }, uFlashCol: { value: new THREE.Color('#d8c8ff') },
      uTime: { value: 0 }, uBloom: { value: 1 }, uCA: { value: 0.2 }, uWater: { value: 0 }, uDrops: { value: 0 },
      uFlash: { value: 0 }, uTorch: { value: 0 }, uVig: { value: 0.7 }, uLift: { value: 0 },
    });
    this.fx = this.mFinal.uniforms;
    this.quad = new THREE.Mesh(this.post.geometry, this.mFinal); this.quad.frustumCulled = false;
    this.fxScene = new THREE.Scene(); this.fxScene.add(this.quad);
    this.bloomLevels = 2;
    this.fxReady = true;
    this.sizeFx();
  }

  setQuality(dpr, bloomLevels = 2) {
    this.dpr = Math.min(window.devicePixelRatio || 1, dpr);
    this.post.material.uniforms.uLine.value = (this.inkStyle?.line ?? 1) * this.dpr;
    this.bloomLevels = bloomLevels;
    this.w = 0; this.resize();
  }

  resize() { super.resize(); this.sizeFx(); }

  sizeFx() {
    if (!this.fxReady) return;
    const w = this.w, h = this.h;
    if (this.fxW === w && this.fxH === h) return;
    this.fxW = w; this.fxH = h;
    this.rtPost.setSize(w, h);
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1), qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    this.rtA.setSize(hw, hh); this.rtB.setSize(hw, hh); this.rtC.setSize(qw, qh); this.rtD.setSize(qw, qh);
    this.fx.uRes.value.set(w, h);
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fxScene, this.postCam);
  }

  blur(src, tmp, w, h, spread) {
    const u = this.mBlur.uniforms;
    u.tIn.value = src.texture; u.uDir.value.set(spread / w, 0); this.pass(this.mBlur, tmp);
    u.tIn.value = tmp.texture; u.uDir.value.set(0, spread / h); this.pass(this.mBlur, src);
  }

  render() {
    if (!this.fxReady) return super.render();
    const { renderer: r, scene, camera } = this;
    r.setClearColor(0x000000, 1);
    scene.overrideMaterial = this.ink;
    const bg = scene.background; scene.background = null;
    camera.layers.set(0);
    r.setRenderTarget(this.rtInk); r.clear(); r.render(scene, camera);
    scene.overrideMaterial = null; scene.background = bg;
    camera.layers.enableAll();
    r.setRenderTarget(this.rtColor); r.clear(); r.render(scene, camera);
    r.setRenderTarget(this.rtPost); r.render(this.postScene, this.postCam);

    // bloom: bright parts → half res blur → quarter res wider blur
    this.mBright.uniforms.tIn.value = this.rtPost.texture;
    this.pass(this.mBright, this.rtA);
    this.blur(this.rtA, this.rtB, this.rtA.width, this.rtA.height, 1.4);
    if (this.bloomLevels > 1) {
      this.mBlur.uniforms.tIn.value = this.rtA.texture; this.mBlur.uniforms.uDir.value.set(0, 0);
      this.pass(this.mBlur, this.rtC);
      this.blur(this.rtC, this.rtD, this.rtC.width, this.rtC.height, 2.2);
      this.blur(this.rtC, this.rtD, this.rtC.width, this.rtC.height, 3.6);
    } else { r.setRenderTarget(this.rtC); r.clear(); }

    this.fx.uTime.value = this.clock.elapsedTime;
    this.pass(this.mFinal, null);
  }
}
