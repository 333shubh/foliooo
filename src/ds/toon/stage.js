import * as THREE from 'three';
import { inkMaterial } from './materials.js';
import { ink as INK } from './palette.js';

/* ==========================================================================
   Stage: renderer + the toon post pass.

   Every frame:
     1. INK pass   — inked objects only (layer 0), override material writes
                     view normal + object id, plus depth.
     2. COLOR pass — everything (sky, clouds, stars live on layer 1 = no ink).
     3. COMPOSITE  — Sobel-ish edge test on depth / normal / id → hairline ink,
                     tinted by the surface underneath, faded with distance.

   Objects opt out of ink with  obj.userData.noInk = true  (set before add).
   Parts that should read as one shape share  obj.userData.inkGroup = 'name'.
   Faceted parts set  obj.userData.flat = 1  so creases get lines too.
   ========================================================================== */

export const LAYER_INK = 0;
export const LAYER_FLAT = 1;

const POST_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FS = /* glsl */ `
  #include <packing>
  uniform sampler2D tColor, tInk, tDepth;
  uniform vec2 uRes; uniform float uLine, uAlpha, uNear, uFar, uFadeNear, uFadeFar, uTint, uBoil, uTime;
  uniform vec3 uInk;
  varying vec2 vUv;
  float lin(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec3 col = texture2D(tColor, vUv).rgb;
    vec2 px = uLine / uRes;
    // line boil: the ink is re-"drawn" 8 times a second with a slightly different wobble
    float frame = floor(uTime * 8.0);
    vec2 boil = (vec2(vn(vUv * 9.0 + frame * 3.1), vn(vUv * 9.0 + frame * 5.7 + 17.0)) - 0.5) * uBoil / uRes * 3.0;
    vec2 uv = vUv + boil;
    vec4 c = texture2D(tInk, uv);
    float dc = lin(uv);
    float edge = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 o = i == 0 ? vec2(px.x, 0.0) : i == 1 ? vec2(-px.x, 0.0) : i == 2 ? vec2(0.0, px.y) : vec2(0.0, -px.y);
      vec4 s = texture2D(tInk, uv + o);
      float ds = lin(uv + o);
      float dz = abs(ds - dc) / min(ds, dc);                 // relative depth jump → silhouettes
      edge = max(edge, smoothstep(0.035, 0.07, dz));
      edge = max(edge, smoothstep(0.30, 0.45, length(s.xy - c.xy) * 2.0)); // creases
      edge = max(edge, step(0.5 / 255.0, abs(s.z - c.z)));    // different objects touch
    }
    float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, dc);
    vec3 line = mix(col * 0.32, uInk, uTint);               // hairline: darker shade of the surface · cartoon: pure ink
    gl_FragColor = vec4(mix(col, line, edge * fade * uAlpha), 1.0);
  }`;

export const INK_STYLES = {
  hairline: { line: 1, tint: 0.5, alpha: 0.9, boil: 0 },
  cartoon: { line: 2, tint: 0.92, alpha: 1, boil: 1 },
};

export class Stage {
  constructor(canvas, { dpr = 2, line = 1, inkAlpha = 0.9, fade = [40, 160] } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.dpr = Math.min(window.devicePixelRatio || 1, dpr);
    this.renderer.setPixelRatio(1); // we size buffers ourselves
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    this.scene = null;
    this.ink = inkMaterial();
    this.pointer = new THREE.Vector2(); this.pointerSmooth = new THREE.Vector2();
    this.updaters = [];
    this.clock = new THREE.Clock();
    this.visible = true;

    const rt = (opts) => new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, ...opts });
    this.rtInk = rt({ depthTexture: new THREE.DepthTexture(1, 1) });
    this.rtColor = rt({ samples: 4, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

    this.post = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)),
      new THREE.ShaderMaterial({
        vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
        uniforms: {
          tColor: { value: this.rtColor.texture }, tInk: { value: this.rtInk.texture }, tDepth: { value: this.rtInk.depthTexture },
          uRes: { value: new THREE.Vector2() }, uLine: { value: line * this.dpr }, uAlpha: { value: inkAlpha },
          uNear: { value: this.camera.near }, uFar: { value: this.camera.far },
          uFadeNear: { value: fade[0] }, uFadeFar: { value: fade[1] }, uInk: { value: new THREE.Color(INK) },
          uTint: { value: 0.5 }, uBoil: { value: 0 }, uTime: { value: 0 },
        },
      }));
    this.post.frustumCulled = false;
    this.postScene = new THREE.Scene(); this.postScene.add(this.post);
    this.postCam = new THREE.OrthographicCamera();

    this.resize = this.resize.bind(this);
    new ResizeObserver(this.resize).observe(canvas);
    this.resize();

    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    });
    canvas.addEventListener('pointerleave', () => this.pointer.set(0, 0));
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { rootMargin: '100px' }).observe(canvas);

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /* Ink styles:
       'hairline' — the reference look: 1px, tinted by the surface (default)
       'cartoon'  — sitcom weight: 2px, pure ink, a little line boil */
  setInk(style = 'hairline', { boil } = {}) {
    const u = this.post.material.uniforms;
    const s = INK_STYLES[style] || style;
    u.uLine.value = s.line * this.dpr; u.uTint.value = s.tint; u.uAlpha.value = s.alpha;
    u.uBoil.value = boil ?? s.boil;
    this.inkStyle = s;
  }

  setWorld(world) {
    this.world = world; this.scene = world.scene;
    world.attach?.(this);
    let i = 0; const groups = new Map();
    this.scene.traverse((o) => {
      if (!o.isMesh && !o.isPoints && !o.isLine) return;
      if (o.userData.noInk || o.isPoints || o.isLine) { o.layers.set(LAYER_FLAT); return; }
      const g = o.userData.inkGroup;
      let id = g && groups.get(g);
      if (!id) { id = (((i++ * 97) % 254) + 1) / 255; if (g) groups.set(g, id); }
      const flat = o.userData.flat || 0;
      o.onBeforeRender = (r, s, c, geo, mat) => {
        if (mat !== this.ink) return;
        mat.uniforms.uId.value = id; mat.uniforms.uFlat.value = flat; mat.uniformsNeedUpdate = true;
      };
    });
    this.resize();
  }

  resize() {
    const w = Math.max(1, Math.round(this.canvas.clientWidth * this.dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * this.dpr));
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.rtInk.setSize(w, h); this.rtColor.setSize(w, h);
    this.post.material.uniforms.uRes.value.set(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.world?.onResize?.(w, h, this.dpr);
    if (this.scene) this.render();
  }

  render() {
    const { renderer: r, scene, camera } = this;
    r.setClearColor(0x000000, 1);
    scene.overrideMaterial = this.ink;
    const bg = scene.background; scene.background = null;
    camera.layers.set(LAYER_INK);
    r.setRenderTarget(this.rtInk); r.clear(); r.render(scene, camera);
    scene.overrideMaterial = null; scene.background = bg;
    camera.layers.enableAll();
    r.setRenderTarget(this.rtColor); r.clear(); r.render(scene, camera);
    r.setRenderTarget(null); r.render(this.postScene, this.postCam);
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    if (!this.visible || this.paused || document.hidden || !this.scene) return;
    this.pointerSmooth.lerp(this.pointer, 1 - Math.pow(0.002, dt));
    this.world.update?.(dt, this.clock.elapsedTime, this);
    this.post.material.uniforms.uTime.value = this.clock.elapsedTime;
    this.render();
    this.onFrame?.(this);
  }
}
