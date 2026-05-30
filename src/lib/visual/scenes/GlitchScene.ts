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
uniform float u_intensity; // 0 = sutil, 1 = agresivo
uniform sampler2D u_prev;

float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
float rand1(float n)  { return fract(sin(n) * 43758.5453); }

void main() {
  vec2 uv = v_uv;
  float t  = u_time;
  float amt = u_intensity;

  // ── Scanline displacement ──
  float scanSeed  = floor(uv.y * 100.0) * 0.01 + floor(t * 10.0) * 0.1;
  float scanDisp  = (rand1(scanSeed) * 2.0 - 1.0) * u_bass * 0.05 * amt;
  vec2  scanUV    = uv + vec2(scanDisp, 0.0);

  // ── Block corruption ──
  vec2 blockUV   = floor(uv * vec2(12.0, 8.0)) / vec2(12.0, 8.0);
  float blockRand = rand(blockUV + floor(t * 5.0));
  bool  corrupt  = blockRand > (1.0 - amt * u_beat * 0.6);

  // ── VHS tracking wave ──
  float vhsFreq = 3.0 + u_mid * 5.0;
  float vhsAmp  = u_overall * 0.015 * amt;
  vec2  vhsUV   = uv + vec2(sin(uv.y * vhsFreq * 6.2832 + t * 4.0) * vhsAmp, 0.0);

  // Combine distortions
  vec2 finalUV = corrupt ? blockUV + vec2(rand(blockUV + t) * 0.1, 0.0) : mix(scanUV, vhsUV, 0.5);
  finalUV = clamp(finalUV, 0.001, 0.999);

  // ── RGB shift ──
  float rgbShift = (0.003 + u_high * 0.012) * amt;
  float r = texture(u_prev, finalUV + vec2( rgbShift, 0.0)).r;
  float g = texture(u_prev, finalUV                       ).g;
  float b = texture(u_prev, finalUV - vec2( rgbShift, 0.0)).b;
  vec4  prev = vec4(r, g, b, 1.0);

  // Pure noise on corrupt blocks
  vec3 noiseCol = vec3(rand(finalUV + t));

  vec3 col = corrupt ? mix(prev.rgb, noiseCol, 0.7) : prev.rgb;

  // Digital color wash
  col = mix(col, u_colorA * length(col), amt * 0.15);

  // Beat flash
  col += u_beat * 0.2 * u_colorC;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class GlitchScene extends BaseScene {
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
    renderer.bindTexture(this._prog, 'u_prev', renderer.prevTex, 0);
    renderer.setUniform1f(this._prog, 'u_intensity', 0.6 + this._beatFlash * 0.4);
    renderer.drawFullscreenQuad();
  }

  render(): void {}
  dispose(): void { this.gl.deleteProgram(this._prog); }
}
