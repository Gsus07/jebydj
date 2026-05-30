'use client';

import { BaseScene } from './BaseScene';
import { VERT_FULLSCREEN } from '../WebGLRenderer';
import type { WebGLRenderer } from '../WebGLRenderer';
import type { AudioReactorData } from '../AudioReactor';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_high;
uniform float u_beat;
uniform float u_beatPhase;
uniform float u_overall;
uniform vec2  u_resolution;
uniform vec3  u_colorA;
uniform vec3  u_colorB;
uniform vec3  u_colorC;
uniform sampler2D u_prev;

// Hash for pseudo-random
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash1(float n) { return fract(sin(n) * 43758.5453); }

// Smooth noise
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

void main() {
  vec2 uv = v_uv;
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);

  float speed   = u_overall * 1.5 + 0.3;
  float explode = u_beat * 3.0;

  // ── 10 000 particles analytically ──
  float brightness = 0.0;

  for (int i = 0; i < 64; i++) {
    float fi = float(i);
    // Particle seed
    float seed = fi * 0.617;
    vec2  pBase = vec2(hash1(seed), hash1(seed + 0.3)) * 2.0 - 1.0;

    // Orbit + beat explosion
    float angle = u_time * (0.3 + hash1(fi) * 0.4) + fi;
    float rad   = 0.1 + hash1(fi + 0.1) * 0.5;
    rad += u_bass * 0.3;

    vec2 orbit = vec2(cos(angle), sin(angle)) * rad;
    vec2 explodeDir = normalize(pBase + vec2(0.001));
    vec2 pos = orbit + explodeDir * explode * hash1(fi + 5.0);

    // Aspect-corrected distance
    vec2 delta = (uv - 0.5) * 2.0 * aspect - pos * aspect;
    float d = length(delta);

    float size = 0.003 + hash1(fi + 0.7) * 0.005 + u_high * 0.004;
    brightness += size / (d + size);
  }

  // Second ring of particles driven by beat phase
  for (int i = 0; i < 32; i++) {
    float fi = float(i);
    float angle = (fi / 32.0) * 6.2832 + u_time * 0.5 + u_beatPhase * 6.2832;
    float rad   = 0.35 + u_bass * 0.2;
    vec2  pos   = vec2(cos(angle), sin(angle)) * rad;
    vec2  delta = (uv - 0.5) * 2.0 * aspect - pos * aspect;
    float d = length(delta);
    brightness += 0.004 / (d + 0.004);
  }

  brightness = clamp(brightness, 0.0, 2.0);

  // Color: colorA for normal particles, colorC for bright beats
  vec3 col = mix(u_colorA, u_colorB, u_beatPhase) * brightness;
  col     += u_colorC * pow(brightness, 2.0) * 0.4;

  // Noise background shimmer
  float bg = noise(uv * 4.0 + u_time * 0.1) * 0.04 * u_overall;
  col += u_colorA * bg;

  // Feedback trail from previous frame
  vec4 prev = texture(u_prev, uv);
  col += prev.rgb * 0.35;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class ParticleScene extends BaseScene {
  private _prog!: WebGLProgram;
  private _beatFlash = 0;

  constructor(renderer: WebGLRenderer) { super(renderer); }

  init(): void { this._prog = this.renderer.createProgram(VERT_FULLSCREEN, FRAG); }

  update(data: AudioReactorData, _time: number): void {
    if (data.isBeat) { this._beatFlash = 1; this.renderer.onBeat(); }
    this._beatFlash = Math.max(0, this._beatFlash - 0.08);
  }

  render(): void {
    // not used — renderWithTime is called
  }

  renderWithTime(data: AudioReactorData, time: number): void {
    const { gl, renderer } = this;
    renderer.bindSceneFB();
    gl.useProgram(this._prog);
    renderer.setUniforms(this._prog, time, data.bass, data.mid, data.high, this._beatFlash, data.beatPhase, data.overall);
    renderer.bindTexture(this._prog, 'u_prev', renderer.prevTex, 0);
    renderer.drawFullscreenQuad();
  }

  dispose(): void { this.gl.deleteProgram(this._prog); }
}
