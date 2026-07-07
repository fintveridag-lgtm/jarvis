const VERTEX_SRC = `#version 300 es
layout(location=0) in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Tron/Jarvis HUD reactor (modeled on design-refs/jarvis.jpg):
// a broad luminous WHITE main ring, a cyan technical core with a tick
// dial and rotating segmented arcs, a dark mechanical outer bezel with
// hairline rings, plate arcs, a mini solar system and rim ticks.
// 3D: every feature group lives on its own depth layer — a lean vector
// shifts the layers apart (parallax) and scales them (perspective) as
// the reactor nods, and a glossy specular sweep crosses the front face.
// Voice (uLevel) flares the white ring and cyan glow.
// Pixels outside the outer radius discard early for performance.
const FRAGMENT_SRC = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform float uTime;
uniform float uLevel;
uniform float uBass;
uniform float uTreble;
uniform vec2 uResolution;

const vec3 ORANGE = vec3(0.980, 0.420, 0.024);
const vec3 CYAN = vec3(0.0, 0.565, 0.788);
const vec3 ICE = vec3(0.55, 0.85, 1.0);
const vec3 DARK = vec3(0.02, 0.02, 0.02);
const float TAU = 6.28318530718;
const float PI = 3.14159265359;

// solsystemets 8 planeter: Merkur, Venus, Jorden, Mars,
// Jupiter, Saturn, Uranus, Neptun
const vec3 PLANET_COL[8] = vec3[8](
  vec3(0.62, 0.58, 0.54),
  vec3(0.92, 0.78, 0.52),
  vec3(0.22, 0.48, 0.88),
  vec3(0.88, 0.38, 0.20),
  vec3(0.82, 0.64, 0.44),
  vec3(0.90, 0.80, 0.55),
  vec3(0.58, 0.82, 0.86),
  vec3(0.28, 0.42, 0.92)
);
const float PLANET_SIZE[8] = float[8](0.013, 0.019, 0.021, 0.017, 0.040, 0.034, 0.026, 0.025);

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// thin ring line centered at r0 with half-width hw
float ringLine(float r, float r0, float hw, float w) {
  return smoothstep(hw + w, max(hw - w, 0.0), abs(r - r0));
}

// solid band between r0..r1
float bandMask(float r, float r0, float r1, float w) {
  return smoothstep(r0 - w, r0 + w, r) * (1.0 - smoothstep(r1 - w, r1 + w, r));
}

// dashed arc: n segments, fill = fraction lit, spins with speed
float dashes(float a, float n, float fill, float spin) {
  return step(fract(a / TAU * n + spin), fill);
}

// shortest angular distance between two angles
float angDist(float a, float b) {
  float d = mod(a - b + PI, TAU) - PI;
  return abs(d);
}

float hash(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

// parallax: layer at height h (h>0 = nearer the viewer) is shifted
// against the lean direction and scaled slightly larger
#define LAYER_UV(h) ((uv - lean * (h)) * (1.0 - (h) * 0.05))

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // fake-3D nodding tilt: squash vertically and rotate slightly over time
  float tilt = sin(uTime * 0.35) * 0.18;
  float squash = 0.82 + 0.05 * cos(uTime * 0.35);
  uv.y /= squash;
  uv = rot(tilt * 0.4) * uv;

  float radius = length(uv);
  float angle = atan(uv.y, uv.x);

  float pulse = 1.0 + uLevel * 0.22;
  float outerR = 0.90 * pulse;

  // layers can poke slightly past the shell — allow a margin before discard
  if (radius > outerR + 0.12) {
    fragColor = vec4(0.0);
    return;
  }

  // lean direction for the parallax stack; wobbles with the nod
  vec2 lean = vec2(sin(uTime * 0.42) * 0.35, -0.85) * 0.055;

  float w = fwidth(radius) + 0.0008;
  float ww = w / pulse;
  vec3 color = vec3(0.0);
  float alpha = 0.0;

  // base plane (h = 0): the white main ring lives here
  float r = radius / pulse;
  float aN = mod(angle + TAU, TAU);
  float depth = 0.7 + 0.3 * sin(angle - tilt);

  // raised core plane (h = +1.2)
  vec2 uvC = LAYER_UV(1.2);
  float rC = length(uvC) / pulse;
  float aC = atan(uvC.y, uvC.x);
  float aNC = mod(aC + TAU, TAU);

  // mid plane for the rotating segments (h = +0.6)
  vec2 uvM = LAYER_UV(0.6);
  float rM = length(uvM) / pulse;
  float aNM = mod(atan(uvM.y, uvM.x) + TAU, TAU);

  // recessed bezel plane (h = -0.9)
  vec2 uvB = LAYER_UV(-0.9);
  float rB = length(uvB) / pulse;
  float aB = atan(uvB.y, uvB.x);
  float aNB = mod(aB + TAU, TAU);
  float depthB = 0.7 + 0.3 * sin(aB - tilt);

  // deepest rim plane (h = -1.3)
  vec2 uvR = LAYER_UV(-1.3);
  float rR = length(uvR) / pulse;
  float aNR = mod(atan(uvR.y, uvR.x) + TAU, TAU);

  // ================= CENTER DIAL (raised plane) =================
  float holeMask = 1.0 - smoothstep(0.050 - ww, 0.050 + ww, rC);
  color = mix(color, DARK, holeMask);
  alpha = max(alpha, holeMask * 0.95);
  float microRing = ringLine(rC, 0.058, 0.004, ww);
  color += vec3(1.0) * microRing * (0.9 + uLevel * 0.6);
  alpha = max(alpha, microRing);

  float dialTicks = dashes(aNC, 28.0, 0.55, -uTime * 0.02) * bandMask(rC, 0.075, 0.098, ww);
  color += ICE * dialTicks * (0.8 + uTreble * 0.8);
  alpha = max(alpha, dialTicks * 0.9);

  // ================= CYAN TECH CORE (raised plane) =================
  float coreGlow = bandMask(rC, 0.06, 0.36, 0.05) * (0.42 + uBass * 0.45 + uLevel * 0.25);
  coreGlow *= 0.88 + 0.12 * sin(uTime * 1.3);
  color += CYAN * coreGlow;
  alpha = max(alpha, coreGlow * 0.85);

  float roseR = 0.30 * (0.45 + 0.55 * abs(cos(6.0 * (aC + uTime * 0.22))));
  float roseMask = smoothstep(ww * 3.5, 0.0, abs(rC - roseR)) * bandMask(rC, 0.09, 0.34, ww);
  color += mix(CYAN, ICE, 0.6) * roseMask * (0.35 + uLevel * 0.7);
  alpha = max(alpha, roseMask * 0.6);

  float coreLines = ringLine(rC, 0.135, 0.0025, ww) + ringLine(rC, 0.175, 0.0025, ww);
  color += CYAN * coreLines * 0.9;
  alpha = max(alpha, coreLines * 0.9);

  // rotating segmented arcs on the mid plane
  float seg1 = dashes(aNM, 12.0, 0.62, uTime * 0.05) * ringLine(rM, 0.225, 0.011, ww);
  color += mix(CYAN, ICE, 0.4) * seg1 * (1.0 + uLevel * 0.9);
  alpha = max(alpha, seg1 * 0.95);
  float seg2 = dashes(aNM, 18.0, 0.5, -uTime * 0.035) * ringLine(rM, 0.30, 0.008, ww);
  color += ICE * seg2 * (0.9 + uTreble * 0.7);
  alpha = max(alpha, seg2 * 0.9);

  // bright cyan band just inside the white ring (mid plane)
  float cyanBand = bandMask(rM, 0.345, 0.385, ww * 2.0);
  color += CYAN * cyanBand * (1.3 + uLevel * 0.8 + uBass * 0.4);
  alpha = max(alpha, cyanBand * 0.95);

  // ================= THE WHITE MAIN RING (base plane) =================
  float whiteCore = bandMask(r, 0.425, 0.525, ww * 2.0);
  float whiteGlow = exp(-pow(abs(r - 0.475) * 14.0, 2.0));
  float shimmer = 1.0 + 0.10 * sin(aN * 3.0 - uTime * 0.8);
  float whiteIntensity = (1.15 + uLevel * 2.0 + uBass * 0.3) * shimmer;
  color += vec3(1.0) * whiteCore * whiteIntensity * (0.85 + depth * 0.15);
  color += mix(vec3(1.0), ICE, 0.5) * whiteGlow * whiteIntensity * 0.55;
  alpha = max(alpha, whiteCore);
  alpha = max(alpha, whiteGlow * 0.8);

  // ================= DARK MECHANICAL BEZEL (recessed plane) =================
  float bezel = bandMask(rB, 0.56, 0.86, ww * 2.0);
  color += vec3(0.030, 0.036, 0.042) * bezel * (0.6 + depthB * 0.4);
  alpha = max(alpha, bezel * 0.72);

  float bezelLines = ringLine(rB, 0.575, 0.0025, ww)
                   + ringLine(rB, 0.655, 0.002, ww)
                   + ringLine(rB, 0.79, 0.002, ww);
  color += CYAN * bezelLines * 0.55 * (0.6 + depthB * 0.4);
  alpha = max(alpha, bezelLines * 0.8);

  float plates = dashes(aNB, 6.0, 0.8, uTime * 0.012) * ringLine(rB, 0.615, 0.024, ww);
  color += CYAN * plates * 0.30;
  alpha = max(alpha, plates * 0.85);

  // one thin ORANGE accent arc, counter-rotating (brand accent)
  float accDiff = mod(aNB - mod(-uTime * 0.25, TAU) + PI, TAU) - PI;
  float accent = smoothstep(0.7, 0.05, abs(accDiff)) * ringLine(rB, 0.685, 0.006, ww);
  color += ORANGE * accent * (1.1 + uLevel * 0.8);
  alpha = max(alpha, accent * 0.9);

  // mini solar system: 8 shaded planets orbiting within the bezel,
  // Merkur innermost/fastest, Neptun outermost/slowest
  vec2 pp = uvB / pulse;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float orbitR = 0.60 + fi * 0.028;
    float speed = 0.16 / (0.6 + fi * 0.35);
    float a = hash(fi * 21.7) * TAU + uTime * speed;
    vec2 nodePos = vec2(cos(a), sin(a)) * orbitR;
    float size = PLANET_SIZE[i];
    vec2 lp = (pp - nodePos) / size;
    float d2 = dot(lp, lp);

    // Saturns skråstilte ring
    if (i == 5) {
      vec2 q = rot(0.55) * lp;
      float ringD = abs(length(vec2(q.x * 0.62, q.y * 1.9)) - 1.15);
      float ringM = smoothstep(0.22, 0.08, ringD) * step(1.0, d2);
      color = mix(color, vec3(0.85, 0.78, 0.60), ringM * 0.85);
      alpha = max(alpha, ringM * 0.85);
    }

    if (d2 < 1.0) {
      // enkel kuleskygge med lys fra øvre venstre
      float nz = sqrt(1.0 - d2);
      vec3 nrm = normalize(vec3(lp, nz));
      float diff = max(dot(nrm, normalize(vec3(-0.45, 0.55, 0.72))), 0.0);
      vec3 pc = PLANET_COL[i];
      if (i == 4) pc *= 0.88 + 0.12 * sin(lp.y * 5.5); // Jupiters bånd
      vec3 shaded = pc * (0.22 + 0.85 * diff);
      float body = 1.0 - smoothstep(0.92, 1.0, sqrt(d2));
      color = mix(color, shaded, body);
      alpha = max(alpha, body);
    }

    // myk glød så planetene løfter seg fra den mørke ytterkanten
    float glow = exp(-d2 * 1.4) * 0.18;
    color += PLANET_COL[i] * glow * (1.0 + uLevel * 0.8);
    alpha = max(alpha, glow);
  }

  // ================= LAYERED BROKEN ARCS (own depth per layer) =================
  // many pseudo-random dashed arc layers at scattered radii, mixed
  // cyan/white/orange, rotating at different speeds — the dense
  // "technical layering" of the reference art
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float hL = (hash(fi * 13.1) - 0.5) * 2.4; // each arc floats at its own height
    vec2 uvL = LAYER_UV(hL);
    float rL = length(uvL) / pulse;
    float aNL = mod(atan(uvL.y, uvL.x) + TAU, TAU);

    float ri = 0.14 + 0.76 * fract(fi / 10.0 + hash(fi * 7.31) * 0.6);
    float th = mix(0.0025, 0.009, hash(fi * 3.7)) + step(0.85, hash(fi * 11.3)) * 0.012;
    float segs = floor(mix(2.0, 22.0, hash(fi * 5.7)));
    float fill = mix(0.35, 0.92, hash(fi * 9.2));
    float spin = (hash(fi * 4.4) - 0.5) * 0.10 * uTime;
    float m = dashes(aNL, segs, fill, spin) * ringLine(rL, ri, th, ww);
    float ch = hash(fi * 6.6);
    vec3 c = ch < 0.42 ? CYAN : (ch < 0.72 ? mix(ICE, vec3(1.0), 0.5) : ORANGE);
    float it = mix(0.35, 1.0, hash(fi * 8.8)) * (0.8 + uLevel * 0.8);
    color += c * m * it * (0.55 + depth * 0.45);
    alpha = max(alpha, m * min(it, 1.0) * 0.85);
  }

  // ================= DIGITAL DATA BLOCKS (bezel plane) =================
  // flickering block-grid wedges that read as streams of tiny data text
  float wedge = smoothstep(0.62, 0.22, angDist(aNB, 2.35))
              + smoothstep(0.62, 0.22, angDist(aNB, 5.55));
  float cu = floor(aNB * 22.0);
  float cv = floor(rB * 56.0);
  float on = step(0.52, hash(cu * 13.7 + cv * 7.9 + floor(uTime * 2.0) * 0.618));
  float bx = step(0.18, fract(aNB * 22.0)) * (1.0 - step(0.82, fract(aNB * 22.0)));
  float by = step(0.15, fract(rB * 56.0)) * (1.0 - step(0.75, fract(rB * 56.0)));
  float dataMask = on * bx * by * bandMask(rB, 0.56, 0.87, ww) * wedge;
  color += mix(CYAN, ICE, 0.4) * dataMask * 0.40;
  alpha = max(alpha, dataMask * 0.45);

  // ================= ASYMMETRIC AMBIENT BLOOMS =================
  // big soft light fields: icy bloom upper-left, warm orange bloom right
  vec2 pnb = uv / pulse;
  vec2 dL = pnb - vec2(-0.34, 0.30);
  float bloomL = exp(-dot(dL, dL) * 6.5) * (0.40 + uLevel * 0.7);
  color += mix(ICE, vec3(1.0), 0.3) * bloomL;
  alpha = max(alpha, bloomL * 0.55);
  vec2 dR = pnb - vec2(0.56, 0.10);
  float bloomR = exp(-dot(dR, dR) * 14.0) * (0.85 + uBass * 0.8 + uLevel * 0.5);
  color += mix(ORANGE, vec3(1.0, 0.78, 0.45), 0.45) * bloomR;
  alpha = max(alpha, bloomR * 0.6);

  // ================= ENERGY & DATA DETAILS =================
  // orange energy glint sweeping slowly around the ring zone
  float sectorD = angDist(aN, uTime * 0.07);
  float sector = exp(-pow(sectorD / 0.45, 2.0)) * bandMask(r, 0.40, 0.80, 0.04);
  color += mix(ORANGE, vec3(1.0, 0.7, 0.35), 0.3) * sector * (0.35 + uLevel * 0.4 + uBass * 0.3);
  alpha = max(alpha, sector * 0.45);

  // long bright cyan arcs just outside the white ring
  float arcs = dashes(aNM, 3.0, 0.82, uTime * 0.016) * ringLine(rM, 0.585, 0.0045, ww);
  color += mix(CYAN, ICE, 0.5) * arcs * (1.1 + uLevel * 0.6);
  alpha = max(alpha, arcs * 0.9);

  // fine cyan data ring + sparse orange dashes in the bezel
  float data1 = dashes(aNB, 48.0, 0.55, -uTime * 0.02) * ringLine(rB, 0.705, 0.004, ww);
  color += CYAN * data1 * 0.8;
  alpha = max(alpha, data1 * 0.85);
  float data2 = dashes(aNB, 10.0, 0.35, uTime * 0.03) * ringLine(rB, 0.755, 0.007, ww);
  color += ORANGE * data2 * (0.75 + uLevel * 0.5);
  alpha = max(alpha, data2 * 0.85);

  // thin radial spokes across the bezel, like HUD grid lines
  float spokeFrac = abs(fract(aNB / TAU * 16.0) - 0.5);
  float spokeMask = smoothstep(0.035, 0.01, spokeFrac) * bandMask(rB, 0.58, 0.85, ww);
  color += mix(CYAN, vec3(1.0), 0.3) * spokeMask * 0.16;
  alpha = max(alpha, spokeMask * 0.28);

  // traveling lens-flare hotspots (one icy on the white ring, one orange in the bezel)
  vec2 pn = uv / pulse;
  float hsA1 = uTime * 0.12;
  vec2 hs1 = vec2(cos(hsA1), sin(hsA1)) * 0.475;
  float g1 = exp(-dot(pn - hs1, pn - hs1) * 90.0);
  color += mix(vec3(1.0), ICE, 0.35) * g1 * (1.0 + uLevel * 1.4);
  alpha = max(alpha, g1 * 0.9);
  float hsA2 = -uTime * 0.09 + 2.2;
  vec2 hs2 = vec2(cos(hsA2), sin(hsA2)) * 0.71;
  float g2 = exp(-dot(pn - hs2, pn - hs2) * 110.0);
  color += ORANGE * g2 * (0.9 + uBass * 0.8);
  alpha = max(alpha, g2 * 0.85);

  // rim tick marks near the outer edge (deepest plane)
  float tickIndex = floor(aNR / TAU * 60.0);
  float tickFrac = fract(aNR / TAU * 60.0) - 0.5;
  float isMajor = step(mod(tickIndex, 5.0), 0.5);
  float tickAng = smoothstep(mix(0.10, 0.16, isMajor), 0.03, abs(tickFrac));
  float ticks = tickAng * bandMask(rR, mix(0.825, 0.805, isMajor), 0.845, ww);
  color += CYAN * ticks * (0.75 + uTreble * 0.6 + uLevel * 0.4);
  alpha = max(alpha, ticks * 0.85);

  // crisp outer rim (deepest plane)
  float rim = ringLine(rR, 0.875, 0.0035, ww);
  color += mix(CYAN, ICE, 0.3) * rim * (0.9 + uLevel * 0.6);
  alpha = max(alpha, rim * 0.95);

  // ================= 3D LIGHTING OVER THE STACK =================
  // glossy specular sweep across the front face, sliding with the nod
  float gl = dot(pn, normalize(vec2(-0.55, 0.83)));
  float glass = exp(-pow(gl - 0.30 - sin(uTime * 0.42) * 0.10, 2.0) * 16.0) * 0.09;
  glass *= 1.0 - smoothstep(0.86, 0.95, r);
  color += vec3(1.0) * glass;
  alpha = max(alpha, glass * 0.6);

  // faint face light: the lower (nearer) half of the disc catches more light
  color *= 0.86 + 0.14 * clamp(-uv.y / 0.9, -1.0, 1.0) * 0.5 + 0.07;

  float edge = 1.0 - smoothstep(outerR + 0.07, outerR + 0.11, radius);
  alpha *= edge;

  fragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}`;

function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

export function createOrb(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL2 er ikke støttet i denne nettleseren.');

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  window.addEventListener('resize', resize);
  resize();

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
  }

  const quad = new Float32Array([-1, -1, 3, -1, -1, 3]);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    uTime: gl.getUniformLocation(program, 'uTime'),
    uLevel: gl.getUniformLocation(program, 'uLevel'),
    uBass: gl.getUniformLocation(program, 'uBass'),
    uTreble: gl.getUniformLocation(program, 'uTreble'),
    uResolution: gl.getUniformLocation(program, 'uResolution'),
  };

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function render(time, level, bass, treble) {
    resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform1f(uniforms.uTime, time);
    gl.uniform1f(uniforms.uLevel, level);
    gl.uniform1f(uniforms.uBass, bass);
    gl.uniform1f(uniforms.uTreble, treble);
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return { render };
}
