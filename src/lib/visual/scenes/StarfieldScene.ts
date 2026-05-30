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
uniform float u_warpBoost; // extra warp on beat

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  vec2 uv  = v_uv * 2.0 - 1.0;
  uv.x    *= u_resolution.x / u_resolution.y;

  float warpMult = 1.0 + u_warpBoost;
  float speed    = (u_overall * 1.5 + 0.3) * warpMult;

  float brightness = 0.0;

  // 5000 stars computed analytically over grid cells
  for (int gx = -4; gx <= 4; gx++) {
    for (int gy = -4; gy <= 4; gy++) {
      float seed = float(gx * 17 + gy * 31 + 1000);
      // Random star position in this cell
      float sx = float(gx) + hash(seed)         - 0.0;
      float sy = float(gy) + hash(seed + 0.1)   - 0.0;
      float sz = hash(seed + 0.2);  // depth 0-1

      // Advance depth with time
      float z  = fract(sz - u_time * speed * 0.15);

      // Perspective project
      float perspective = 1.0 / (z + 0.01);
      vec2  proj = vec2(sx, sy) * perspective * 0.5;

      // Distance from fragment
      vec2  delta = uv - proj;
      float d     = length(delta);

      // Star size: closer = bigger
      float size = 0.001 + (1.0 - z) * 0.006 + u_high * 0.003;

      // Trail length based on speed
      float trailLen = speed * 0.08 * warpMult;
      vec2  trailDir = -normalize(proj + vec2(0.0001)) * trailLen;
      // Trail: closest point on line segment from proj to proj+trail
      vec2  toFrag = uv - proj;
      float tParam = clamp(dot(toFrag, trailDir) / (dot(trailDir, trailDir) + 0.0001), 0.0, 1.0);
      float trailD = length(toFrag - trailDir * tParam);

      float star  = size / (d * d + size * 0.5);
      float trail = size * 0.3 / (trailD * trailD + size * 0.2) * (1.0 - tParam);
      brightness += (star + trail) * (1.0 - z);
    }
  }

  brightness = clamp(brightness, 0.0, 3.0);

  // Color: white core, colorA/B glow
  float warpGlow = clamp(speed * 0.3, 0.0, 1.0);
  vec3 col = vec3(1.0) * min(brightness, 1.0);
  col     += u_colorA * max(brightness - 1.0, 0.0) * 0.5;
  col     += u_colorB * warpGlow * 0.2;

  // Beat burst
  col += u_beat * u_colorC * 0.3;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class StarfieldScene extends BaseScene {
  private _prog!: WebGLProgram;
  private _beatFlash = 0;
  private _warpBoost = 0;

  constructor(renderer: WebGLRenderer) { super(renderer); }

  init(): void { this._prog = this.renderer.createProgram(VERT_FULLSCREEN, FRAG); }

  update(data: AudioReactorData, _time: number): void {
    if (data.isBeat) {
      this._beatFlash = 1;
      this._warpBoost = 9.0; // 10× speed burst
      this.renderer.onBeat();
    }
    this._beatFlash = Math.max(0, this._beatFlash - 0.07);
    this._warpBoost = Math.max(0, this._warpBoost - 0.4); // decay over ~500ms
  }

  renderWithTime(data: AudioReactorData, time: number): void {
    const { gl, renderer } = this;
    renderer.bindSceneFB();
    gl.useProgram(this._prog);
    renderer.setUniforms(this._prog, time, data.bass, data.mid, data.high, this._beatFlash, data.beatPhase, data.overall);
    renderer.setUniform1f(this._prog, 'u_warpBoost', this._warpBoost);
    renderer.drawFullscreenQuad();
  }

  render(): void {}
  dispose(): void { this.gl.deleteProgram(this._prog); }
}
