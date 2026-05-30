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
uniform float u_freqX;
uniform float u_freqY;
uniform float u_freqZ;
uniform float u_phase;

#define PI 3.14159265359
#define TRAIL_LEN 800

void main() {
  vec2 uv   = (v_uv * 2.0 - 1.0);
  uv.x     *= u_resolution.x / u_resolution.y;

  float brightness = 0.0;
  vec3  col        = vec3(0.0);

  // Draw TRAIL_LEN points of the Lissajous curve
  float closest = 999.0;
  float closestT = 0.0;

  for (int i = 0; i < TRAIL_LEN; i++) {
    float ti = float(i) / float(TRAIL_LEN);
    float t  = ti * PI * 2.0 * 4.0; // 4 cycles

    // 3D Lissajous + rotation
    float rx = sin(u_freqX * t + u_phase);
    float ry = sin(u_freqY * t);
    float rz = sin(u_freqZ * t + PI * 0.5);

    // Rotate slowly in 3D (project to 2D)
    float rotY = u_time * 0.2;
    float rotX = u_time * 0.13;

    // Y rotation
    float x1 = rx * cos(rotY) - rz * sin(rotY);
    float z1 = rx * sin(rotY) + rz * cos(rotY);

    // X rotation
    float y2 = ry * cos(rotX) - z1 * sin(rotX);
    float z2 = ry * sin(rotX) + z1 * cos(rotX);

    // Perspective
    float persp = 1.0 / (z2 * 0.3 + 1.5);
    vec2 p = vec2(x1, y2) * persp * (0.7 + u_overall * 0.3);

    float d = length(uv - p);
    if (d < closest) { closest = d; closestT = ti; }

    // Line contribution
    float w = 0.003 + u_high * 0.002;
    brightness += w / (d + w);
  }

  // Color along trail
  vec3 trailCol = closestT < 0.333 ? mix(u_colorA, u_colorB, closestT * 3.0)
                : closestT < 0.667 ? mix(u_colorB, u_colorC, (closestT - 0.333) * 3.0)
                :                    mix(u_colorC, u_colorA, (closestT - 0.667) * 3.0);

  col = trailCol * brightness;
  col += u_beat * 0.3 * u_colorC;

  fragColor = vec4(clamp(col * 0.6, 0.0, 1.0), 1.0);
}`;

export class LissajousScene extends BaseScene {
  private _prog!: WebGLProgram;
  private _beatFlash = 0;
  private _phase = 0;
  private _freqX = 3;
  private _freqY = 4;
  private _freqZ = 5;

  constructor(renderer: WebGLRenderer) { super(renderer); }

  init(): void { this._prog = this.renderer.createProgram(VERT_FULLSCREEN, FRAG); }

  update(data: AudioReactorData, _time: number): void {
    if (data.isBeat) {
      this._beatFlash = 1;
      this.renderer.onBeat();
      // Change frequencies on beat to create new figures
      this._phase += Math.PI * 0.25;
      if (data.beatIntensity > 0.9) {
        this._freqX = 2 + Math.floor(Math.random() * 5);
        this._freqY = 2 + Math.floor(Math.random() * 5);
        this._freqZ = 2 + Math.floor(Math.random() * 5);
      }
    }
    this._beatFlash = Math.max(0, this._beatFlash - 0.06);
    // Drift frequencies subtly with audio
    this._freqX += data.bass * 0.01;
    this._freqY += data.mid  * 0.008;
    this._freqZ += data.high * 0.006;
    if (this._freqX > 8) this._freqX = 2;
    if (this._freqY > 8) this._freqY = 2;
    if (this._freqZ > 8) this._freqZ = 2;
  }

  renderWithTime(data: AudioReactorData, time: number): void {
    const { gl, renderer } = this;
    renderer.bindSceneFB();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this._prog);
    renderer.setUniforms(this._prog, time, data.bass, data.mid, data.high, this._beatFlash, data.beatPhase, data.overall);
    renderer.setUniform1f(this._prog, 'u_freqX', this._freqX);
    renderer.setUniform1f(this._prog, 'u_freqY', this._freqY);
    renderer.setUniform1f(this._prog, 'u_freqZ', this._freqZ);
    renderer.setUniform1f(this._prog, 'u_phase',  this._phase);
    renderer.drawFullscreenQuad();
  }

  render(): void {}
  dispose(): void { this.gl.deleteProgram(this._prog); }
}
