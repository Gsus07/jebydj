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
uniform sampler2D u_spectrum; // 256×1 spectrum texture

#define BARS 128

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;

  // Which bar are we in?
  float barIdx = uv.x * float(BARS);
  int   bar    = int(floor(barIdx));
  float barFrac = fract(barIdx);

  // Bar gap
  if (barFrac < 0.08 || barFrac > 0.92) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  // Sample spectrum at this bar (squared for drama)
  float specVal = texture(u_spectrum, vec2((float(bar) + 0.5) / float(BARS), 0.5)).r;
  specVal = pow(specVal, 1.8);

  // Elastic scale on beat
  float beatScale = 1.0 + u_beat * 0.25 * exp(-float(bar) * 0.03);
  specVal *= beatScale;

  // The bar height
  float barH = specVal;

  vec3 col = vec3(0.0);

  // Main bar
  if (uv.y < barH) {
    // Color gradient: colorA (low) → colorB (mid) → colorC (top)
    float t = uv.y / max(barH, 0.001);
    vec3 barCol = t < 0.5 ? mix(u_colorA, u_colorB, t * 2.0) : mix(u_colorB, u_colorC, (t - 0.5) * 2.0);
    float glow  = pow(t, 2.5) * 2.0;
    col += barCol * (0.8 + glow);
  }

  // Reflection (mirrored below y=0, i.e., below the floor)
  float reflY = -uv.y + 0.0;
  if (uv.y < 0.0 && -uv.y < barH) {
    float t  = (-uv.y) / barH;
    vec3  rc = mix(u_colorA, u_colorB, t);
    col += rc * (1.0 - t) * 0.3;
  }

  // Spectrum "peak" dot
  float peakY = barH + 0.006;
  if (abs(uv.y - peakY) < 0.004) {
    col += u_colorC * 2.0;
  }

  // Floor line
  if (abs(uv.y) < 0.003) col += u_colorA * 0.5;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class FrequencyScene extends BaseScene {
  private _prog!: WebGLProgram;
  private _specTex!: WebGLTexture;
  private _beatFlash = 0;

  constructor(renderer: WebGLRenderer) { super(renderer); }

  init(): void {
    this._prog    = this.renderer.createProgram(VERT_FULLSCREEN, FRAG);
    this._specTex = this.renderer.createTexture(256, 1);
  }

  update(data: AudioReactorData, _time: number): void {
    if (data.isBeat) { this._beatFlash = 1; this.renderer.onBeat(); }
    this._beatFlash = Math.max(0, this._beatFlash - 0.07);
    this.renderer.updateTexture1D(this._specTex, data.spectrum);
  }

  renderWithTime(data: AudioReactorData, time: number): void {
    const { gl, renderer } = this;
    renderer.bindSceneFB();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this._prog);
    renderer.setUniforms(this._prog, time, data.bass, data.mid, data.high, this._beatFlash, data.beatPhase, data.overall);
    renderer.bindTexture(this._prog, 'u_spectrum', this._specTex, 0);
    renderer.drawFullscreenQuad();
  }

  render(): void {}
  dispose(): void {
    this.gl.deleteProgram(this._prog);
    this.gl.deleteTexture(this._specTex);
  }
}
