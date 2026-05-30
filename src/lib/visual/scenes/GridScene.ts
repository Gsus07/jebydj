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

// Value noise
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}

// Grid line SDF
float gridLine(float v, float freq, float width) {
  return smoothstep(width, 0.0, abs(fract(v * freq + 0.5) - 0.5) / freq);
}

void main() {
  // Perspective ray
  vec2 uv = v_uv * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;

  // Floor plane
  float speed  = 0.4 + u_overall * 1.0;
  float camZ   = u_time * speed;
  float fov    = 0.6;
  vec3  ro     = vec3(0.0, 1.0, camZ);
  vec3  rd     = normalize(vec3(uv * fov, 1.0));

  // Intersect with y=0 plane
  float t = -ro.y / rd.y;

  vec3 col = vec3(0.0);

  if (t > 0.0) {
    vec3 hit = ro + rd * t;

    // Grid lines
    float freq   = 1.0;
    float lw     = 0.02 + u_bass * 0.04;
    float gridX  = gridLine(hit.x, freq, lw);
    float gridZ  = gridLine(hit.z, freq, lw);
    float grid   = max(gridX, gridZ);

    // Horizon fade
    float fog = 1.0 / (1.0 + t * t * 0.04);

    // Mountain silhouette using noise
    float mx    = noise(vec2(hit.x * 0.3, 0.0)) * (1.5 + u_mid * 2.0);
    float mountH = mx - hit.z * 0.0; // static mountain
    // We only care about the horizon strip
    float horizonY  = uv.y;
    float mountain  = smoothstep(-0.05, 0.0, horizonY + 0.08 - mx * 0.12 * fog);

    // Floor color
    vec3 floorCol = mix(u_colorB * 0.15, u_colorA, grid) * fog;

    // Grid pulses with beat
    floorCol += u_beat * u_colorC * grid * 0.5;

    col = floorCol;

    // Horizon glow
    float hGlow = smoothstep(0.25, 0.0, abs(horizonY - (-0.05))) * 0.5;
    col += u_colorB * hGlow * (0.5 + u_bass * 0.5);
  }

  // Sky gradient
  float skyT = clamp(uv.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 sky   = mix(u_colorB * 0.2, vec3(0.0), skyT);

  // Sun
  vec2  sunPos = vec2(0.0, 0.12);
  float sunD   = length(vec2(uv.x, uv.y) - sunPos);
  float sun    = smoothstep(0.15 + u_bass * 0.03, 0.14, sunD);
  float sunGlow= exp(-sunD * 3.0) * 0.3 * (0.5 + u_bass * 0.5);
  sky += u_colorC * sun;
  sky += u_colorB * sunGlow;

  if (t <= 0.0) col = sky;
  else col += sky * 0.15;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class GridScene extends BaseScene {
  private _prog!: WebGLProgram;
  private _beatFlash = 0;

  constructor(renderer: WebGLRenderer) { super(renderer); }

  init(): void { this._prog = this.renderer.createProgram(VERT_FULLSCREEN, FRAG); }

  update(data: AudioReactorData, _time: number): void {
    if (data.isBeat) { this._beatFlash = 1; this.renderer.onBeat(); }
    this._beatFlash = Math.max(0, this._beatFlash - 0.07);
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
