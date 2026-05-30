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

#define PI 3.14159265359

// Hexagonal tile pattern
vec2 hexCoord(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / vec4(s, s)) + 0.5;
  vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
}

void main() {
  vec2 fc = (v_uv * 2.0 - 1.0) * vec2(u_resolution.x / u_resolution.y, 1.0);

  float speed  = u_overall * 2.0 + 0.5;
  float radius = length(fc);
  float angle  = atan(fc.y, fc.x);
  float depth  = 1.0 / (radius + 0.001);

  // Warp tunnel coordinate
  float t = u_time * speed - depth;

  // Hex grid on the tunnel wall
  vec2 tunnelUV = vec2(angle / PI, t * 0.5);
  vec2 hCoord   = hexCoord(tunnelUV * (2.0 + u_mid * 3.0));
  float hDist   = length(hCoord);
  float pattern = smoothstep(0.45 + u_bass * 0.1, 0.42, hDist);

  // Tunnel depth radial distortion
  float radialDistort = sin(radius * 8.0 + t * 3.0) * u_bass * 0.15;
  float distortedR    = radius + radialDistort;

  // Color reactive to audio
  float hue = fract(t * 0.1 + u_bass * 0.3);
  vec3 wallCol = mix(u_colorA, u_colorB, sin(t + u_bass * PI) * 0.5 + 0.5);
  wallCol      = mix(wallCol, u_colorC, pattern * 0.5);
  wallCol     *= depth * 0.15;

  // Lines along tunnel
  float lineW = 0.01 + u_high * 0.015;
  float nLines = 8.0;
  float lineAngle = fract(angle / PI * nLines * 0.5 + 0.5) ;
  float linePat   = smoothstep(lineW, 0.0, abs(lineAngle - 0.5) - (0.5 - lineW));
  wallCol += linePat * u_colorA * 0.3 * (0.5 + u_high * 0.5) / (distortedR + 0.5);

  // Beat flash
  wallCol += u_beat * 0.4 * u_colorC / (distortedR + 0.3);

  // Chromatic aberration hint
  wallCol.r *= 1.0 + u_high * 0.1;

  fragColor = vec4(clamp(wallCol, 0.0, 1.0), 1.0);
}`;

export class TunnelScene extends BaseScene {
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
