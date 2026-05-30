'use client';

import { BaseScene } from './BaseScene';
import { VERT_FULLSCREEN } from '../WebGLRenderer';
import type { WebGLRenderer } from '../WebGLRenderer';
import type { AudioReactorData } from '../AudioReactor';

// Default starter shader shown in editor
const DEFAULT_FRAG = `#version 300 es
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

void main() {
  vec2 uv = v_uv * 2.0 - 1.0;
  uv.x   *= u_resolution.x / u_resolution.y;

  float r = length(uv);
  float a = atan(uv.y, uv.x);

  float wave = sin(a * 6.0 + u_time * 2.0) * 0.5 + 0.5;
  float ring = smoothstep(0.02, 0.0, abs(r - 0.5 - wave * 0.2 * u_bass));

  vec3 col = mix(u_colorA, u_colorB, wave) * ring;
  col     += u_colorC * u_beat * 0.4;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// Error fallback shader - solid red with error indicator
const ERROR_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec2 uv = v_uv;
  float stripe = step(0.5, fract(uv.x * 10.0 + uv.y * 10.0));
  fragColor = vec4(stripe * 0.4, 0.0, 0.0, 1.0);
}`;

export class CustomShaderScene extends BaseScene {
  private _prog!: WebGLProgram;
  private _errorProg!: WebGLProgram;
  private _beatFlash = 0;
  private _hasError = false;
  private _errorMessage = '';

  /** Current GLSL source for the fragment shader */
  currentSource = DEFAULT_FRAG;

  /** Last compile error message (empty if none) */
  get compileError(): string { return this._errorMessage; }

  /** Whether the last compile had an error */
  get hasError(): boolean { return this._hasError; }

  constructor(renderer: WebGLRenderer) { super(renderer); }

  init(): void {
    this._prog      = this.renderer.createProgram(VERT_FULLSCREEN, DEFAULT_FRAG);
    this._errorProg = this.renderer.createProgram(VERT_FULLSCREEN, ERROR_FRAG);
  }

  /**
   * Attempt live-compile a new fragment shader source.
   * Returns true on success, false on error (compileError is populated).
   */
  compile(fragSrc: string): boolean {
    const [newProg, err] = this.renderer.tryCreateProgram(VERT_FULLSCREEN, fragSrc);
    if (newProg) {
      // Delete old program if it's not the error fallback
      if (this._prog !== this._errorProg) {
        this.gl.deleteProgram(this._prog);
      }
      this._prog = newProg;
      this.currentSource = fragSrc;
      this._hasError = false;
      this._errorMessage = '';
      return true;
    } else {
      this._hasError = true;
      this._errorMessage = err ?? 'Unknown compile error';
      return false;
    }
  }

  update(data: AudioReactorData, _time: number): void {
    if (data.isBeat) { this._beatFlash = 1; this.renderer.onBeat(); }
    this._beatFlash = Math.max(0, this._beatFlash - 0.07);
  }

  renderWithTime(data: AudioReactorData, time: number): void {
    const { gl, renderer } = this;
    renderer.bindSceneFB();
    const prog = this._hasError ? this._errorProg : this._prog;
    gl.useProgram(prog);
    if (!this._hasError) {
      renderer.setUniforms(prog, time, data.bass, data.mid, data.high, this._beatFlash, data.beatPhase, data.overall);
    }
    renderer.drawFullscreenQuad();
  }

  render(): void {}

  dispose(): void {
    this.gl.deleteProgram(this._prog);
    this.gl.deleteProgram(this._errorProg);
  }
}
