/* GLSL for the hero. Kept in one module so the gradient is shared by the sky and the water. */

/** The brand's Rise gradient (--gradient-hero, 160deg), evaluated per fragment in screen space. */
export const riseGradientGLSL = /* glsl */ `
  vec3 riseGradient(vec2 uv, float aspect) {
    // CSS linear-gradient(160deg): direction from top, clockwise. y is up here.
    const float a = radians(160.0);
    vec2 dir = vec2(sin(a), -cos(a));
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
    float len = aspect * abs(sin(a)) + abs(cos(a));
    float t = clamp(dot(p, dir) / len + 0.5, 0.0, 1.0);
    vec3 ink = vec3(0.059, 0.165, 0.180);   // #0f2a2e
    vec3 plum = vec3(0.290, 0.122, 0.271);  // #4a1f45
    vec3 rose = vec3(0.784, 0.196, 0.416);  // #c8326a
    vec3 c = ink;
    c = mix(c, plum, smoothstep(0.35, 0.70, t));
    c = mix(c, rose, smoothstep(0.70, 1.00, t));
    return c;
  }
`;

export const skyVertex = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.99999, 1.0);
  }
`;

export const skyFragment = /* glsl */ `
  precision highp float;
  uniform vec2 uResolution;
  ${riseGradientGLSL}
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    gl_FragColor = vec4(riseGradient(uv, uResolution.x / uResolution.y), 1.0);
  }
`;

export const waterVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * Dark Pond Ink water. A flat quad; the waves live in the normal (procedural height field,
 * finite differences), so it costs one triangle pair and a few dozen ALU ops per pixel.
 * Ripples are a small ring buffer of cursor impacts. The mark's glow reflects as a rose streak.
 */
export const waterFragment = /* glsl */ `
  precision highp float;
  #define MAX_RIPPLES 8
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uCamera;
  uniform vec4 uRipples[MAX_RIPPLES]; // x, z, impact time, strength
  uniform vec3 uGlowPos;              // world position of the glowing mark
  uniform float uGlow;                // 0..1 glow strength (fades once the mark has gone)
  uniform float uWave;                // wave amplitude multiplier (lite tier lowers it)
  varying vec3 vWorld;
  ${riseGradientGLSL}

  // Sine-free hash: the classic sin() hash falls apart in mediump on phones.
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float height(vec2 p, float t) {
    float h = 0.0;
    h += sin(p.x * 0.55 + p.y * 0.35 + t * 0.55) * 0.045;
    h += sin(p.x * 1.10 - p.y * 0.60 - t * 0.42) * 0.030;
    h += (noise(p * 0.75 + vec2(t * 0.11, -t * 0.07)) - 0.5) * 0.11;
    h += (noise(p * 2.30 - vec2(t * 0.05, t * 0.09)) - 0.5) * 0.035;
    h *= uWave;
    for (int i = 0; i < MAX_RIPPLES; i++) {
      vec4 r = uRipples[i];
      float age = t - r.z;
      if (r.w <= 0.0 || age < 0.0 || age > 5.0) continue;
      float d = length(p - r.xy);
      float front = age * 2.2;                       // ring radius grows with age
      float ring = exp(-pow((d - front) * 1.6, 2.0)); // soft ring at the wave front
      float wave = sin(d * 7.0 - age * 9.0) * ring;
      h += wave * r.w * 0.05 * exp(-age * 0.75) * exp(-d * 0.22);
    }
    return h;
  }

  void main() {
    vec2 p = vWorld.xz;
    float t = uTime;
    float e = 0.08;
    float hl = height(p - vec2(e, 0.0), t);
    float hr = height(p + vec2(e, 0.0), t);
    float hd = height(p - vec2(0.0, e), t);
    float hu = height(p + vec2(0.0, e), t);
    vec3 n = normalize(vec3(hl - hr, 2.0 * e, hd - hu));

    vec3 view = normalize(uCamera - vWorld);
    float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);

    vec3 deep = vec3(0.028, 0.085, 0.095);
    vec3 ink = vec3(0.059, 0.165, 0.180);
    vec3 color = mix(deep, ink, 0.25 + fres * 0.75);

    // The Rise sky mirrored in the water: what is above a stretch of water (sampled upside down
    // in screen space) shows on it at grazing angles, so the plum and rose carry into the pond.
    vec2 uv = gl_FragCoord.xy / uResolution;
    float aspect = uResolution.x / uResolution.y;
    vec3 above = riseGradient(vec2(uv.x + n.x * 0.35, 1.0 - uv.y * 0.55 + n.z * 0.3), aspect);
    color += above * (0.10 + fres * 0.55);

    // A soft key light from the upper left; glints ride the small waves.
    vec3 L = normalize(vec3(-0.35, 0.75, 0.55));
    float spec = pow(max(dot(reflect(-L, n), view), 0.0), 60.0);
    color += vec3(0.62, 0.74, 0.76) * spec * 0.55;

    // The mark's light on the water: a rose streak toward the camera, broken up by the waves.
    vec2 g = vec2(vWorld.x - uGlowPos.x + n.x * 2.4, vWorld.z - uGlowPos.z);
    float streak = exp(-g.x * g.x * 0.9) * exp(-max(g.y, 0.0) * 0.16) * smoothstep(-2.0, 1.5, g.y);
    streak *= 0.55 + 0.45 * noise(vec2(vWorld.x * 3.0, vWorld.z * 1.5 - t * 0.6));
    color += vec3(0.784, 0.196, 0.416) * streak * 0.7 * uGlow;

    // Far water dissolves into the Rise gradient behind it, so there is no horizon seam.
    vec3 sky = riseGradient(uv, aspect);
    float dist = length(uCamera - vWorld);
    float fog = smoothstep(9.0, 30.0, dist);
    color = mix(color, sky, fog);
    // A little of the gradient shows through the surface, so the water carries the brand's plum undertone.
    color = mix(color, sky, 0.2 * (1.0 - fog));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const pointsVertex = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uScale;      // base point size in pixels at the mark plane
  uniform float uPixelRatio;
  uniform float uHalo;       // 1 = soft wide halo pass, 0 = bright core pass
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 0.78 + 0.22 * sin(uTime * (1.2 + aSeed * 2.4) + aSeed * 6.2831);
    vTwinkle = tw;
    vColor = aColor;
    float halo = mix(1.0, 3.4, uHalo);
    gl_PointSize = aSize * uScale * uPixelRatio * halo * (0.55 + 0.45 * tw) * (9.8 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

export const pointsFragment = /* glsl */ `
  precision highp float;
  uniform float uOpacity;
  uniform float uHalo;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float core = pow(1.0 - d, 1.6);
    float soft = pow(1.0 - d, 3.2);
    float a = mix(core, soft, uHalo) * uOpacity * (0.7 + 0.3 * vTwinkle);
    gl_FragColor = vec4(vColor, a);
  }
`;
