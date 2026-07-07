const VERTEX_SRC = `#version 300 es
layout(location=0) in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Arc-reactor style orb: concentric rings alternating orange/cyan, a
// spirograph rose in the core, four glowing nodes, and a dark center hole.
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
const vec3 DARK = vec3(0.02, 0.02, 0.02);

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // fake-3D nodding tilt: squash vertically and rotate slightly over time
  float tilt = sin(uTime * 0.35) * 0.18;
  float squash = 0.78 + 0.06 * cos(uTime * 0.35);
  uv.y /= squash;
  uv = rot(tilt * 0.4) * uv;

  float radius = length(uv);
  float angle = atan(uv.y, uv.x);

  float pulse = 1.0 + uLevel * 0.35;
  float outerR = 0.86 * pulse;

  if (radius > outerR) {
    fragColor = vec4(0.0);
    return;
  }

  float w = fwidth(radius) + 0.0008;
  vec3 color = vec3(0.0);
  float alpha = 0.0;

  // depth shading: lighter toward the "front" face of the tilted disc
  float depth = 0.5 + 0.5 * sin(angle - tilt);

  // concentric rings
  float ringCount = 10.0;
  float ringPhase = radius * ringCount - uTime * (0.6 + uLevel * 1.4 + uBass * 0.8);
  float ringDist = abs(fract(ringPhase) - 0.5) * 2.0;
  float ringMask = smoothstep(0.5, 0.5 - w * ringCount * 1.6, ringDist);
  ringMask *= 1.0 - smoothstep(outerR - 0.035, outerR, radius);
  float ringIndex = floor(ringPhase);
  vec3 ringColor = mix(ORANGE, CYAN, mod(ringIndex, 2.0));
  color += ringColor * ringMask * (0.55 + uLevel * 0.7) * (0.6 + depth * 0.4);
  alpha = max(alpha, ringMask * 0.9);

  // spirograph rose core
  float coreR = 0.42 * pulse;
  if (radius < coreR) {
    float k = 5.0;
    float roseR = coreR * (0.35 + 0.65 * abs(cos(k * (angle + uTime * 0.5))));
    float roseLine = abs(radius - roseR);
    float roseMask = smoothstep(w * 3.0, 0.0, roseLine);
    vec3 roseColor = mix(CYAN, vec3(1.0), 0.3 + 0.5 * uLevel);
    color += roseColor * roseMask * (0.8 + uLevel + uTreble * 0.6);
    alpha = max(alpha, roseMask);

    float holeR = 0.10 * (1.0 - uLevel * 0.3);
    float holeMask = 1.0 - smoothstep(holeR - w, holeR + w, radius);
    color = mix(color, DARK, holeMask);
    alpha = max(alpha, holeMask * 0.95);
  }

  // four glowing nodes orbiting at mid-radius
  float nodeR = 0.62 * pulse;
  for (int i = 0; i < 4; i++) {
    float a = float(i) * 1.5707963 + uTime * 0.25;
    vec2 nodePos = vec2(cos(a), sin(a)) * nodeR;
    float d = length(uv - nodePos);
    float glow = smoothstep(0.16, 0.0, d) * (0.5 + uLevel * 1.6 + uBass * 0.5);
    color += CYAN * glow;
    alpha = max(alpha, glow * 0.8);
  }

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
