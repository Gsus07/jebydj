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
uniform float u_julia;    // 0 = Mandelbrot, 1 = Julia
uniform vec2  u_juliaC;   // Julia c parameter
uniform float u_zoom;
uniform vec2  u_center;

#define MAX_ITER 128

// Smooth iteration count
float mandelbrot(vec2 c, int maxIter) {
  vec2 z = vec2(0.0);
  for (int i = 0; i < MAX_ITER; i++) {
    if (i >= maxIter) break;
    z = vec2(z.x * z.x - z.y * z.y + c.x, 2.0 * z.x * z.y + c.y);
    if (dot(z, z) > 4.0) {
      return float(i) - log2(log2(dot(z, z)));
    }
  }
  return 0.0;
}

float julia(vec2 z, vec2 c, int maxIter) {
  for (int i = 0; i < MAX_ITER; i++) {
    if (i >= maxIter) break;
    z = vec2(z.x * z.x - z.y * z.y + c.x, 2.0 * z.x * z.y + c.y);
    if (dot(z, z) > 4.0) {
      return float(i) - log2(log2(dot(z, z)));
    }
  }
  return 0.0;
}

void main() {
  vec2 uv = (v_uv * 2.0 - 1.0) * vec2(u_resolution.x / u_resolution.y, 1.0);

  // Navigate with audio
  float zoom     = u_zoom * (1.0 + u_bass * 0.15);
  vec2  coord    = (uv / zoom) + u_center;
  int   maxIter  = 48 + int(u_high * 80.0);

  float n;
  if (u_julia > 0.5) {
    n = julia(coord, u_juliaC, maxIter);
  } else {
    n = mandelbrot(coord, maxIter);
  }

  // Smooth coloring
  float t = n / float(maxIter);

  vec3 col;
  if (n < 0.001) {
    // Inside the set
    col = u_colorA * 0.05;
  } else {
    // Color cycling
    float cycle = fract(t * 3.0 + u_time * 0.05 + u_bass * 0.2);
    col = cycle < 0.333 ? mix(u_colorA, u_colorB, cycle * 3.0)
        : cycle < 0.667 ? mix(u_colorB, u_colorC, (cycle - 0.333) * 3.0)
        :                 mix(u_colorC, u_colorA, (cycle - 0.667) * 3.0);
    col *= 1.0 + t * 2.0;
  }

  // Beat flash
  col += u_beat * 0.3 * u_colorC;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// Precalculated points of interest for Mandelbrot navigation
const WAYPOINTS: Array<[number, number, number]> = [ // cx, cy, zoom
  [-0.7269,  0.1889,  80],
  [-0.5557,  0.6228,  120],
  [ 0.3602,  0.1000,  60],
  [-0.5251, -0.5751,  100],
  [-0.8253,  0.2017,  200],
];

export class FractalScene extends BaseScene {
  private _prog!: WebGLProgram;
  private _beatFlash = 0;
  private _waypointIdx = 0;
  private _waypointProgress = 0;
  private _juliaMode = false;
  private _juliaC: [number, number] = [-0.7, 0.27];
  private _juliaAngle = 0;

  constructor(renderer: WebGLRenderer) { super(renderer); }

  init(): void { this._prog = this.renderer.createProgram(VERT_FULLSCREEN, FRAG); }

  update(data: AudioReactorData, _time: number): void {
    if (data.isBeat) {
      this._beatFlash = 1;
      this.renderer.onBeat();
      // Advance waypoint every 8 beats
      this._waypointProgress += 0.125;
      if (this._waypointProgress >= 1) {
        this._waypointProgress = 0;
        this._waypointIdx = (this._waypointIdx + 1) % WAYPOINTS.length;
        this._juliaMode = Math.random() > 0.6;
      }
    }
    this._beatFlash = Math.max(0, this._beatFlash - 0.07);
    // Julia c orbits
    this._juliaAngle += 0.003 + data.mid * 0.002;
    this._juliaC = [
      Math.cos(this._juliaAngle) * 0.7885,
      Math.sin(this._juliaAngle) * 0.7885,
    ];
  }

  renderWithTime(data: AudioReactorData, time: number): void {
    const { gl, renderer } = this;
    renderer.bindSceneFB();
    gl.useProgram(this._prog);
    renderer.setUniforms(this._prog, time, data.bass, data.mid, data.high, this._beatFlash, data.beatPhase, data.overall);

    // Interpolate between waypoints
    const from = WAYPOINTS[this._waypointIdx];
    const to   = WAYPOINTS[(this._waypointIdx + 1) % WAYPOINTS.length];
    const t    = this._waypointProgress;
    const cx   = from[0] + (to[0] - from[0]) * t;
    const cy   = from[1] + (to[1] - from[1]) * t;
    const zm   = from[2] + (to[2] - from[2]) * t;

    renderer.setUniform1f(this._prog, 'u_julia', this._juliaMode ? 1 : 0);
    const juliaLoc = gl.getUniformLocation(this._prog, 'u_juliaC');
    if (juliaLoc) gl.uniform2f(juliaLoc, this._juliaC[0], this._juliaC[1]);
    renderer.setUniform1f(this._prog, 'u_zoom', zm);
    const centerLoc = gl.getUniformLocation(this._prog, 'u_center');
    if (centerLoc) gl.uniform2f(centerLoc, cx, cy);

    renderer.drawFullscreenQuad();
  }

  render(): void {}
  dispose(): void { this.gl.deleteProgram(this._prog); }
}
