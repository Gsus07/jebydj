'use client';

import { BaseScene } from './BaseScene';
import { VERT_FULLSCREEN } from '../WebGLRenderer';
import type { WebGLRenderer } from '../WebGLRenderer';
import type { AudioReactorData } from '../AudioReactor';

const HISTORY_FRAMES = 128;

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
uniform sampler2D u_waveformHistory; // 256×HISTORY rows of waveform data

void main() {
  vec2 uv = v_uv;

  float ribbonY = uv.y;
  float waveX   = uv.x;

  // Pick the row of the waveform history (0 = most recent, 1 = oldest)
  float histRow = ribbonY;
  float waveVal = texture(u_waveformHistory, vec2(waveX, 1.0 - histRow)).r * 2.0 - 1.0;

  // Scale waveform amplitude reactively
  float amp = (0.3 + u_overall * 0.7) * (1.0 + u_bass * 0.5);
  float scaledWave = waveVal * amp * 0.2; // world-space height offset

  // Distance from the ribbon surface (simplified 2D: how far we are from waveVal)
  float surfY = 0.5 + scaledWave - ribbonY;
  float d = abs(surfY * u_resolution.y / u_resolution.x);

  // Line thickness
  float thick = 1.5 + u_bass * 3.0 + u_beat * 5.0;
  float line  = smoothstep(thick + 1.0, thick - 0.5, d);

  // Color: colorA (front) → colorB (back)
  vec3 col = mix(u_colorA, u_colorB, histRow);
  col = mix(col, u_colorC, pow(abs(waveVal), 2.0));

  // Fade older frames
  float alpha = (1.0 - histRow) * (1.0 - histRow) * line;

  // Mirror (butterfly effect)
  float mirror = ribbonY < 0.5 ? uv.y * 2.0 : (1.0 - uv.y) * 2.0;
  alpha *= 0.7 + mirror * 0.3;

  fragColor = vec4(col * alpha, alpha);
}`;

export class WaveformScene extends BaseScene {
  private _prog!: WebGLProgram;
  private _histTex!: WebGLTexture;
  private _history: Uint8Array;
  private _histIdx = 0;
  private _beatFlash = 0;

  constructor(renderer: WebGLRenderer) {
    super(renderer);
    this._history = new Uint8Array(256 * HISTORY_FRAMES * 4);
  }

  init(): void {
    this._prog    = this.renderer.createProgram(VERT_FULLSCREEN, FRAG);
    this._histTex = this.renderer.createTexture(256, HISTORY_FRAMES, this._history);
  }

  update(data: AudioReactorData, _time: number): void {
    if (data.isBeat) { this._beatFlash = 1; this.renderer.onBeat(); }
    this._beatFlash = Math.max(0, this._beatFlash - 0.06);

    // Shift history up and write newest frame at the top
    const stride = 256 * 4;
    this._history.copyWithin(stride, 0, stride * (HISTORY_FRAMES - 1));
    for (let i = 0; i < 256; i++) {
      const v = Math.floor((data.waveform[i] * 0.5 + 0.5) * 255);
      this._history[i * 4 + 0] = v;
      this._history[i * 4 + 1] = v;
      this._history[i * 4 + 2] = v;
      this._history[i * 4 + 3] = 255;
    }
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this._histTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, HISTORY_FRAMES, gl.RGBA, gl.UNSIGNED_BYTE, this._history);
    this._histIdx = (this._histIdx + 1) % HISTORY_FRAMES;
  }

  renderWithTime(data: AudioReactorData, time: number): void {
    const { gl, renderer } = this;
    renderer.bindSceneFB();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this._prog);
    renderer.setUniforms(this._prog, time, data.bass, data.mid, data.high, this._beatFlash, data.beatPhase, data.overall);
    renderer.bindTexture(this._prog, 'u_waveformHistory', this._histTex, 0);
    renderer.drawFullscreenQuad();
  }

  render(): void {}

  dispose(): void {
    this.gl.deleteProgram(this._prog);
    this.gl.deleteTexture(this._histTex);
  }
}
