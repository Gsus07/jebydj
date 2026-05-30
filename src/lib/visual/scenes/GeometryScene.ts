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

#define PI  3.14159265359
#define TAU 6.28318530718

// Rotation matrix
mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

// SDF — regular polygon distance
float sdPolygon(vec2 p, float r, int n) {
  float a = atan(p.y, p.x) - PI * 0.5;
  float b = TAU / float(n);
  float d = cos(floor(0.5 + a / b) * b - a) * length(p);
  return d - r;
}

// SDF — torus (2D cross-section)
float sdTorus(vec2 p, vec2 t) {
  return abs(length(p) - t.x) - t.y;
}

// Glow: soft exponential
float glow(float d, float w, float str) {
  return str * exp(-max(0.0, d) / w);
}

void main() {
  vec2 uv = (v_uv * 2.0 - 1.0);
  uv.x *= u_resolution.x / u_resolution.y;

  float t      = u_time * 0.4;
  float spinA  = t * (1.0 + u_mid * 0.5);
  float spinB  = -t * (0.7 + u_bass * 0.4);
  float scale  = 1.0 + u_bass * 0.35 + u_beat * 0.15;

  vec3 col = vec3(0.0);

  // ── Outer icosahedron (12 edges, 2D projection of hexagon) ──
  vec2 p0 = uv * rot(spinA) / scale;
  float d0 = sdPolygon(p0, 0.65, 6);
  col += glow(abs(d0), 0.015, 1.5) * u_colorA;

  // ── Mid dodecagon (12-sided, slightly rotated) ──
  vec2 p1 = uv * rot(spinA * 1.3) / (scale * 0.72);
  float d1 = sdPolygon(p1, 0.65, 12);
  col += glow(abs(d1), 0.012, 1.2) * u_colorB;

  // ── Inner spinning triangle ──
  vec2 p2 = uv * rot(spinB) / (scale * 0.4);
  float d2 = sdPolygon(p2, 0.65, 3);
  col += glow(abs(d2), 0.018, 1.8) * u_colorC;

  // ── Torus rings ──
  vec2 p3 = uv * rot(spinA * 0.5) / scale;
  for (int i = 0; i < 3; i++) {
    float r = 0.25 + float(i) * 0.18;
    float w = 0.004 + u_high * 0.008;
    float dt = sdTorus(p3, vec2(r, w));
    vec3 tc = mix(u_colorA, u_colorC, float(i) / 2.0);
    col += glow(abs(dt), 0.01, 0.8) * tc;
  }

  // ── Beat flash ──
  col += u_beat * 0.25 * mix(u_colorB, u_colorC, u_beatPhase);

  // ── Central light point ──
  float cd = length(uv);
  col += u_colorA * 0.2 * exp(-cd * (8.0 - u_bass * 4.0));

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class GeometryScene extends BaseScene {
  private _prog!: WebGLProgram;
  private _beatFlash = 0;

  constructor(renderer: WebGLRenderer) { super(renderer); }

  init(): void { this._prog = this.renderer.createProgram(VERT_FULLSCREEN, FRAG); }

  update(data: AudioReactorData, _time: number): void {
    if (data.isBeat) { this._beatFlash = 1; this.renderer.onBeat(); }
    this._beatFlash = Math.max(0, this._beatFlash - 0.06);
  }

  renderWithTime(data: AudioReactorData, time: number): void {
    const { gl, renderer } = this;
    renderer.bindSceneFB();
    gl.useProgram(this._prog);
    renderer.setUniforms(this._prog, time, data.bass, data.mid, data.high, this._beatFlash, data.beatPhase, data.overall);
    renderer.drawFullscreenQuad();
  }

  render(): void {}
  dispose(): void { this.gl.deleteProgram(this._prog); }
}
