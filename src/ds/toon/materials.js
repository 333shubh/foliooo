import * as THREE from 'three';
import { tones } from './palette.js';

// Flat cartoon colour: a hex in the palette is the hex on screen.
// (Must run before any THREE.Color is made; stage.js renders in sRGB-as-linear.)
THREE.ColorManagement.enabled = false;

const C = (hex) => new THREE.Color(hex);

// One light for the whole world, shared by every toon surface.
const LIGHT = { value: new THREE.Vector3(0.5, 0.8, 0.6).normalize() };
export const setLight = (v) => LIGHT.value.set(...v).normalize();
// A colour grade every toon surface is multiplied by (1,1,1 = as painted). The About page
// turns it up for daylight and down for night; other pages never touch it.
export const GRADE = { value: new THREE.Vector3(1, 1, 1) };
export const setGrade = (r, g, b) => GRADE.value.set(r, g, b);

/* ------------------------------------------------------------------------
   toon(): three hard bands (shade / base / light) + optional rim band.
   flat: 1 = faceted (rocks, crystals), 0 = smooth (hills, pod, clouds).
   rim:  0..0.5 — width of the light band around the silhouette.
   ------------------------------------------------------------------------ */
// vertexColors: true → each vertex carries its own base colour (one mesh, many terrains);
// shade and light tones are derived from it so the three-band look still holds.
export function toon(tone = 'violet', { flat = 0, rim = 0, t1 = -0.05, t2 = 0.55, side = THREE.FrontSide, vertexColors = false } = {}) {
  const t = typeof tone === 'string' ? tones[tone] : tone;
  const m = new THREE.ShaderMaterial({
    side, fog: true, vertexColors,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uShade: { value: C(t.shade) }, uBase: { value: C(t.base) }, uLight: { value: C(t.light) },
      uT1: { value: t1 }, uT2: { value: t2 }, uFlat: { value: flat }, uRim: { value: rim },
    }]),
    vertexShader: TOON_VS,
    fragmentShader: TOON_FS,
  });
  m.uniforms.uLightDir = LIGHT; // shared reference, not a copy
  m.uniforms.uGrade = GRADE;
  return m;
}

const TOON_VS = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vN; varying vec3 vW;
  #ifdef USE_COLOR
    varying vec3 vC;
  #endif
  void main() {
    #ifdef USE_INSTANCING
      vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    #else
      vec4 w = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
    #endif
    #ifdef USE_COLOR
      vC = color;
    #endif
    vW = w.xyz;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const TOON_FS = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uShade, uBase, uLight, uLightDir, uGrade;
  uniform float uT1, uT2, uFlat, uRim;
  varying vec3 vN; varying vec3 vW;
  #ifdef USE_COLOR
    varying vec3 vC;
  #endif
  void main() {
    #ifdef USE_COLOR
      vec3 base = vC, shade = vC * vec3(0.6, 0.55, 0.74), lite = min(vC * 1.16 + vec3(0.05, 0.04, 0.07), vec3(1.0));
    #else
      vec3 base = uBase, shade = uShade, lite = uLight;
    #endif
    vec3 fn = normalize(cross(dFdx(vW), dFdy(vW)));
    vec3 n = normalize(mix(normalize(vN), fn, uFlat));
    float d = dot(n, uLightDir);
    float aa = fwidth(d) + 0.002;
    vec3 c = mix(shade, base, smoothstep(uT1 - aa, uT1 + aa, d));
    c = mix(c, lite, smoothstep(uT2 - aa, uT2 + aa, d));
    if (uRim > 0.0) {
      float r = 1.0 - max(dot(n, normalize(cameraPosition - vW)), 0.0);
      float ra = fwidth(r) + 0.002;
      c = mix(c, lite, smoothstep(1.0 - uRim - ra, 1.0 - uRim + ra, r) * 0.8);
    }
    gl_FragColor = vec4(c * uGrade, 1.0);
    #include <fog_fragment>
  }`;

/* ------------------------------------------------------------------------
   Water: flat base with drifting cartoon ripple stripes.
   ------------------------------------------------------------------------ */
export function waterMaterial(tone = 'water') {
  const t = tones[tone];
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uShade: { value: C(t.shade) }, uBase: { value: C(t.base) }, uLight: { value: C(t.light) }, uTime: { value: 0 },
    }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uShade, uBase, uLight; uniform float uTime;
      varying vec3 vW;
      void main() {
        vec2 p = vW.xz;
        float wave = sin(p.x * 0.35 + sin(p.y * 0.25 + uTime * 0.6) * 1.6 + uTime * 0.8);
        float band = sin(p.y * 0.9 + wave * 1.4);
        float aa = fwidth(band) + 0.002;
        vec3 c = mix(uBase, uLight, smoothstep(0.93 - aa, 0.93 + aa, band));
        float depth = smoothstep(0.0, 60.0, -vW.z);           // further water reads lighter
        c = mix(c, mix(uBase, uLight, 0.35), depth * 0.5);
        float dark = sin(p.x * 0.12 + p.y * 0.07 + uTime * 0.2);
        c = mix(c, uShade, smoothstep(0.92, 0.95, dark) * 0.6); // slow drifting dark patches
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
}

/* ------------------------------------------------------------------------
   Sky: 3-stop vertical gradient on an inside-out sphere.
   ------------------------------------------------------------------------ */
export function skyMaterial([top, mid, bottom]) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: C(top) }, uMid: { value: C(mid) }, uBottom: { value: C(bottom) } },
    vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uBottom; varying vec3 vP;
      void main() {
        float h = vP.y;
        vec3 c = h > 0.12 ? mix(uMid, uTop, smoothstep(0.12, 0.75, h)) : mix(uBottom, uMid, smoothstep(-0.15, 0.12, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

/* ------------------------------------------------------------------------
   Stars: soft glow points that twinkle. aBright scales size per star.
   ------------------------------------------------------------------------ */
export function starMaterial(color = '#ffffff') {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: C(color) }, uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aBright; uniform float uTime, uPx; varying float vB;
      void main() {
        vB = aBright * (0.75 + 0.25 * sin(uTime * 2.0 + position.x * 13.0 + position.y * 7.0));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (3.0 + 22.0 * aBright) * uPx;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vB;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(0.22, 0.0, d);
        float halo = pow(max(1.0 - d, 0.0), 3.0) * 0.55;
        gl_FragColor = vec4(uColor, (core + halo) * vB);
      }`,
  });
}

/* ------------------------------------------------------------------------
   Ink pass: what the outline shader "sees". Writes the flat view-space
   normal (rg) and a per-object id (b). Assigned as scene.overrideMaterial.
   ------------------------------------------------------------------------ */
export function inkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uId: { value: 0 }, uFlat: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vV; varying vec3 vN;
      void main() {
        #ifdef USE_INSTANCING
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          vN = normalMatrix * mat3(instanceMatrix) * normal;
        #else
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalMatrix * normal;
        #endif
        vV = mv.xyz; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uId, uFlat; varying vec3 vV; varying vec3 vN;
      void main() {
        vec3 n = normalize(mix(normalize(vN), normalize(cross(dFdx(vV), dFdy(vV))), uFlat));
        gl_FragColor = vec4(n.xy * 0.5 + 0.5, uId, 1.0);
      }`,
  });
}
