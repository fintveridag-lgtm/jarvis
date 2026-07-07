const VERTEX_SRC = `#version 300 es
layout(location=0) in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Tron/Jarvis HUD reactor (modeled on design-refs/jarvis.jpg):
// a broad luminous WHITE main ring, a cyan technical core with a tick
// dial and rotating segmented arcs, a dark mechanical outer bezel with
// hairline rings, plate arcs, 8 small circle nodes and rim ticks.
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

  if (radius > outerR) {
    fragColor = vec4(0.0);
    return;
  }

  float w = fwidth(radius) + 0.0008;
  float r = radius / pulse;      // feature-space radius (pulses as a whole)
  float ww = w / pulse;
  float aN = mod(angle + TAU, TAU);
  vec3 color = vec3(0.0);
  float alpha = 0.0;

  // depth shading: lighter toward the "front" face of the tilted disc
  float depth = 0.7 + 0.3 * sin(angle - tilt);

  // ================= CENTER DIAL =================
  // dark hole with a crisp white micro-ring around it
  float holeMask = 1.0 - smoothstep(0.050 - ww, 0.050 + ww, r);
  color = mix(color, DARK, holeMask);
  alpha = max(alpha, holeMask * 0.95);
  float microRing = ringLine(r, 0.058, 0.004, ww);
  color += vec3(1.0) * microRing * (0.9 + uLevel * 0.6);
  alpha = max(alpha, microRing);

  // small tick dial (like the inner instrument ring)
  float dialTicks = dashes(aN, 28.0, 0.55, -uTime * 0.02) * bandMask(r, 0.075, 0.098, ww);
  color += ICE * dialTicks * (0.8 + uTreble * 0.8);
  alpha = max(alpha, dialTicks * 0.9);

  // ================= CYAN TECH CORE =================
  // soft cyan glow disc filling the core
  float coreGlow = bandMask(r, 0.06, 0.36, 0.05) * (0.42 + uBass * 0.45 + uLevel * 0.25);
  coreGlow *= 0.88 + 0.12 * sin(uTime * 1.3);
  color += CYAN * coreGlow;
  alpha = max(alpha, coreGlow * 0.85);

  // faint icy petal structure for organic motion
  float roseR = 0.30 * (0.45 + 0.55 * abs(cos(6.0 * (angle + uTime * 0.22))));
  float roseMask = smoothstep(ww * 3.5, 0.0, abs(r - roseR)) * bandMask(r, 0.09, 0.34, ww);
  color += mix(CYAN, ICE, 0.6) * roseMask * (0.35 + uLevel * 0.7);
  alpha = max(alpha, roseMask * 0.6);

  // thin cyan hairlines in the core
  float coreLines = ringLine(r, 0.135, 0.0025, ww) + ringLine(r, 0.175, 0.0025, ww);
  color += CYAN * coreLines * 0.9;
  alpha = max(alpha, coreLines * 0.9);

  // rotating segmented arcs (two counter-rotating dashed rings)
  float seg1 = dashes(aN, 12.0, 0.62, uTime * 0.05) * ringLine(r, 0.225, 0.011, ww);
  color += mix(CYAN, ICE, 0.4) * seg1 * (1.0 + uLevel * 0.9);
  alpha = max(alpha, seg1 * 0.95);
  float seg2 = dashes(aN, 18.0, 0.5, -uTime * 0.035) * ringLine(r, 0.30, 0.008, ww);
  color += ICE * seg2 * (0.9 + uTreble * 0.7);
  alpha = max(alpha, seg2 * 0.9);

  // bright cyan band just inside the white ring
  float cyanBand = bandMask(r, 0.345, 0.385, ww * 2.0);
  color += CYAN * cyanBand * (1.3 + uLevel * 0.8 + uBass * 0.4);
  alpha = max(alpha, cyanBand * 0.95);

  // ================= THE WHITE MAIN RING =================
  float whiteCore = bandMask(r, 0.425, 0.525, ww * 2.0);
  float whiteGlow = exp(-pow(abs(r - 0.475) * 14.0, 2.0));
  // subtle rotating shimmer so it feels alive even at rest
  float shimmer = 1.0 + 0.10 * sin(aN * 3.0 - uTime * 0.8);
  float whiteIntensity = (1.15 + uLevel * 2.0 + uBass * 0.3) * shimmer;
  color += vec3(1.0) * whiteCore * whiteIntensity * (0.85 + depth * 0.15);
  color += mix(vec3(1.0), ICE, 0.5) * whiteGlow * whiteIntensity * 0.55;
  alpha = max(alpha, whiteCore);
  alpha = max(alpha, whiteGlow * 0.8);

  // ================= DARK MECHANICAL BEZEL =================
  float bezel = bandMask(r, 0.56, 0.86, ww * 2.0);
  color += vec3(0.030, 0.036, 0.042) * bezel * (0.6 + depth * 0.4);
  alpha = max(alpha, bezel * 0.72);

  // hairline cyan rings across the bezel
  float bezelLines = ringLine(r, 0.575, 0.0025, ww)
                   + ringLine(r, 0.655, 0.002, ww)
                   + ringLine(r, 0.79, 0.002, ww);
  color += CYAN * bezelLines * 0.55 * (0.6 + depth * 0.4);
  alpha = max(alpha, bezelLines * 0.8);

  // slow mechanical plate arcs (dark cyan segments)
  float plates = dashes(aN, 6.0, 0.8, uTime * 0.012) * ringLine(r, 0.615, 0.024, ww);
  color += CYAN * plates * 0.30;
  alpha = max(alpha, plates * 0.85);

  // one thin ORANGE accent arc, counter-rotating (brand accent)
  float accDiff = mod(aN - mod(-uTime * 0.25, TAU) + PI, TAU) - PI;
  float accent = smoothstep(0.7, 0.05, abs(accDiff)) * ringLine(r, 0.685, 0.006, ww);
  color += ORANGE * accent * (1.1 + uLevel * 0.8);
  alpha = max(alpha, accent * 0.9);

  // 8 small circle nodes studded around the bezel
  for (int i = 0; i < 8; i++) {
    float a = float(i) * (TAU / 8.0) + uTime * 0.04;
    vec2 nodePos = vec2(cos(a), sin(a)) * 0.725;
    float d = length(uv / pulse - nodePos);
    float nodeRing = smoothstep(0.010, 0.004, abs(d - 0.030));
    float nodeFill = 1.0 - smoothstep(0.024, 0.030, d);
    color = mix(color, DARK, nodeFill * 0.9);
    color += mix(vec3(1.0), ICE, 0.35) * nodeRing * (0.85 + uLevel * 1.2 + uTreble * 0.5);
    alpha = max(alpha, max(nodeRing, nodeFill * 0.9));
  }

  // ================= ENERGY & DATA DETAILS =================
  // broad orange energy sector sweeping slowly around the ring zone
  float sectorD = angDist(aN, uTime * 0.07);
  float sector = exp(-pow(sectorD / 0.85, 2.0)) * bandMask(r, 0.38, 0.86, 0.04);
  color += ORANGE * sector * (0.30 + uLevel * 0.35 + uBass * 0.25);
  alpha = max(alpha, sector * 0.5);

  // long bright cyan arcs just outside the white ring
  float arcs = dashes(aN, 3.0, 0.82, uTime * 0.016) * ringLine(r, 0.585, 0.0045, ww);
  color += mix(CYAN, ICE, 0.5) * arcs * (1.1 + uLevel * 0.6);
  alpha = max(alpha, arcs * 0.9);

  // fine cyan data ring + sparse orange dashes in the bezel
  float data1 = dashes(aN, 48.0, 0.55, -uTime * 0.02) * ringLine(r, 0.705, 0.004, ww);
  color += CYAN * data1 * 0.8;
  alpha = max(alpha, data1 * 0.85);
  float data2 = dashes(aN, 10.0, 0.35, uTime * 0.03) * ringLine(r, 0.755, 0.007, ww);
  color += ORANGE * data2 * (0.75 + uLevel * 0.5);
  alpha = max(alpha, data2 * 0.85);

  // thin radial spokes across the bezel, like HUD grid lines
  float spokeFrac = abs(fract(aN / TAU * 16.0) - 0.5);
  float spokeMask = smoothstep(0.035, 0.01, spokeFrac) * bandMask(r, 0.58, 0.85, ww);
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

  // rim tick marks near the outer edge
  float tickIndex = floor(aN / TAU * 60.0);
  float tickFrac = fract(aN / TAU * 60.0) - 0.5;
  float isMajor = step(mod(tickIndex, 5.0), 0.5);
  float tickAng = smoothstep(mix(0.10, 0.16, isMajor), 0.03, abs(tickFrac));
  float ticks = tickAng * bandMask(r, mix(0.825, 0.805, isMajor), 0.845, ww);
  color += CYAN * ticks * (0.75 + uTreble * 0.6 + uLevel * 0.4);
  alpha = max(alpha, ticks * 0.85);

  // crisp outer rim
  float rim = ringLine(r, 0.875, 0.0035, ww);
  color += mix(CYAN, ICE, 0.3) * rim * (0.9 + uLevel * 0.6);
  alpha = max(alpha, rim * 0.95);

  float edge = 1.0 - smoothstep(outerR - w * 2.0, outerR, radius);
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
