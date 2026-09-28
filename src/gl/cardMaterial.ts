import * as THREE from 'three';

/**
 * One shader draws every card: the image, the paper frame around it, the
 * per-slot dim and the flex while it moves. One mesh
 * is one card, one draw call.
 *
 * Deliberately absent: chromatic aberration, RGB split, glitch. Those read as
 * tech demo, not as a print on a table.
 */

const PAPER_LIGHT = new THREE.Color('#F4F1EC');
const PAPER_DARK = new THREE.Color('#111111');

export const FRAME_PX = 14;

const vertexShader = /* glsl */ `
  uniform vec2 uVelocity;   // screen-space speed of this card, −1..1
  uniform float uFlex;      // 0 kills the bend (reduced motion)
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = position;      // plane is 1×1, so p.xy is −0.5..0.5

    float speed = min(length(uVelocity), 1.0);
    if (speed > 0.001) {
      vec2 dir = normalize(uVelocity);
      // Across the direction of travel: the middle lags, the edges lead.
      float axis = clamp(dot(p.xy * 2.0, dir), -1.0, 1.0);
      float bow = 1.0 - axis * axis;
      p.xy -= dir * bow * 0.02 * speed * uFlex;
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTex;
  uniform float uHasTex;
  uniform float uImageAspect;
  uniform vec2 uPlaneSize;    // on-screen size in CSS pixels
  uniform vec2 uFocal;        // 0..1, where to keep the subject
  uniform float uFrame;       // paper border, in pixels
  uniform vec3 uPaper;        // card stock
  uniform float uDim;         // brightness for this slot
  uniform vec2 uVelocity;
  uniform float uZoom;        // 1.04 → 1.00 settle on the active card
  uniform float uAlpha;
  uniform float uGlass;       // 1 on the glass slot: a blank frosted card

  varying vec2 vUv;

  void main() {
    vec2 px = vUv * uPlaneSize;
    float edge = min(min(px.x, uPlaneSize.x - px.x),
                     min(px.y, uPlaneSize.y - px.y));

    vec3 color = uPaper;
    float inner = step(uFrame, edge);   // 1 inside the image window

    if (uHasTex > 0.5 && inner > 0.5) {
      // Remap to the window inside the paper border.
      vec2 window = uPlaneSize - 2.0 * uFrame;
      vec2 uv = (px - uFrame) / window;

      // Cover-fit, centred on the focal point, like object-fit: cover.
      float planeAspect = window.x / window.y;
      vec2 centred = uv - 0.5;
      if (planeAspect > uImageAspect) {
        float k = uImageAspect / planeAspect;
        centred.y *= k;
        centred.y += (uFocal.y - 0.5) * (1.0 - k);
      } else {
        float k = planeAspect / uImageAspect;
        centred.x *= k;
        centred.x += (uFocal.x - 0.5) * (1.0 - k);
      }

      // The slow settle, and a small parallax against the direction of travel.
      centred /= uZoom;
      centred -= uVelocity * 0.03;

      vec2 sampleUv = clamp(centred + 0.5, 0.001, 0.999);
      color = texture2D(uTex, sampleUv).rgb;
    } else if (uGlass > 0.5) {
      // A blank frosted card. The readable glass is the HTML layer on top.
      float diag = clamp((vUv.x + 1.0 - vUv.y) * 0.5, 0.0, 1.0);
      color = mix(vec3(1.0), uPaper, 0.35) + diag * 0.06;
    } else if (inner > 0.5) {
      // Type-led stock: a barely-there vertical lift, so it is not a flat fill.
      color = uPaper * (0.985 + vUv.y * 0.02);
    }

    // A 1 px inner line at 6% black, just inside the border.
    float line = smoothstep(uFrame + 1.0, uFrame, edge) *
                 smoothstep(uFrame - 1.5, uFrame - 0.5, edge);
    color = mix(color, color * 0.94, line * 0.6);

    color *= uDim;

    gl_FragColor = vec4(color, uAlpha);
    #include <colorspace_fragment>
  }
`;

export type CardMaterialOptions = {
  tone?: 'light' | 'dark';
  glass?: boolean;
};

export function createCardMaterial(
  options: CardMaterialOptions = {},
): THREE.ShaderMaterial {
  const paper = options.tone === 'dark' ? PAPER_DARK : PAPER_LIGHT;

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    // Draw order comes from the slot, not from depth.
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTex: { value: null },
      uHasTex: { value: 0 },
      uImageAspect: { value: 0.8 },
      uPlaneSize: { value: new THREE.Vector2(400, 500) },
      uFocal: { value: new THREE.Vector2(0.5, 0.5) },
      uFrame: { value: FRAME_PX },
      uPaper: { value: paper.clone() },
      uDim: { value: 1 },
      uVelocity: { value: new THREE.Vector2(0, 0) },
      uZoom: { value: 1 },
      uAlpha: { value: 1 },
      uGlass: { value: options.glass ? 1 : 0 },
      uFlex: { value: 1 },
    },
  });
}

/**
 * The soft shadow under each card: a separate blurred quad at 25% black.
 * Cheaper and softer than anything the card shader could do itself.
 */
const shadowFragment = /* glsl */ `
  precision mediump float;
  uniform float uAlpha;
  uniform float uSoftness;
  varying vec2 vUv;

  void main() {
    vec2 d = abs(vUv - 0.5) * 2.0;
    float falloff = 1.0 - smoothstep(1.0 - uSoftness, 1.0, max(d.x, d.y));
    float radial = 1.0 - smoothstep(0.0, 1.0, length(d) * 0.72);
    gl_FragColor = vec4(0.0, 0.0, 0.0, falloff * radial * 0.25 * uAlpha);
  }
`;

const shadowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export function createShadowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: shadowVertex,
    fragmentShader: shadowFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uAlpha: { value: 1 },
      uSoftness: { value: 0.55 },
    },
  });
}

/**
 * The room behind the deck: the active card's own image, blurred hard and held
 * at 14% opacity, with slow fbm fog mixed in. The light in the room changes
 * with each photo.
 */
const backdropFragment = /* glsl */ `
  precision mediump float;

  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform float uMix;
  uniform float uHasA;
  uniform float uHasB;
  uniform float uTime;
  uniform float uFog;
  uniform float uOpacity;
  uniform vec3 uBase;

  varying vec2 vUv;

  // A cheap heavy blur: sample the texture at a high mip level. The LOD bias
  // costs one tap instead of a blur pass.
  vec3 blurred(sampler2D tex, vec2 uv) {
    vec3 sum = texture2D(tex, uv, 8.0).rgb;
    sum += texture2D(tex, uv + vec2(0.06, 0.0), 8.0).rgb;
    sum += texture2D(tex, uv - vec2(0.06, 0.0), 8.0).rgb;
    sum += texture2D(tex, uv + vec2(0.0, 0.06), 8.0).rgb;
    sum += texture2D(tex, uv - vec2(0.0, 0.06), 8.0).rgb;
    return sum * 0.2;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Scaled 1.3× about the centre.
    vec2 uv = (vUv - 0.5) / 1.3 + 0.5;

    vec3 image = vec3(0.0);
    float weight = 0.0;
    if (uHasA > 0.5) { image += blurred(uTexA, uv) * (1.0 - uMix); weight += 1.0 - uMix; }
    if (uHasB > 0.5) { image += blurred(uTexB, uv) * uMix; weight += uMix; }

    vec3 color = uBase;
    if (weight > 0.001) color = mix(uBase, image / max(weight, 0.001), uOpacity * weight);

    float fog = fbm(vUv * 2.4 + vec2(uTime * 0.012, uTime * -0.008));
    color = mix(color, vec3(1.0), fog * uFog);

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createBackdropMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: shadowVertex,
    fragmentShader: backdropFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTexA: { value: null },
      uTexB: { value: null },
      uMix: { value: 0 },
      uHasA: { value: 0 },
      uHasB: { value: 0 },
      uTime: { value: 0 },
      uFog: { value: 0.14 },
      uOpacity: { value: 0.14 },
      uBase: { value: new THREE.Color('#F2EFEA') },
    },
  });
}
