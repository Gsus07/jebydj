'use client';

import { BaseScene } from './BaseScene';
import { VERT_FULLSCREEN } from '../WebGLRenderer';
import type { WebGLRenderer } from '../WebGLRenderer';
import type { AudioReactorData } from '../AudioReactor';

// Two-pass fluid: velocity advect + density advect using ping-pong textures
const FRAG_ADVECT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_vel;  // xy = velocity, zw = unused
uniform sampler2D u_dens; // rgba = density (color)
uniform vec2 u_res;
uniform float u_dissipation;
uniform float u_dt;

void main() {
  vec2 texel = 1.0 / u_res;
  vec2 vel   = texture(u_vel, v_uv).xy;
  // Back-trace position
  vec2 pos   = v_uv - vel * u_dt * texel;
  pos        = clamp(pos, texel, 1.0 - texel);
  vec4 dens  = texture(u_dens, pos) * u_dissipation;
  fragColor  = dens;
}`;

const FRAG_INJECT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_dens;
uniform vec2  u_pos;    // inject position (0-1)
uniform vec3  u_color;
uniform float u_radius;
uniform float u_strength;

void main() {
  vec4 curr = texture(u_dens, v_uv);
  float d   = distance(v_uv, u_pos);
  float spl = exp(-d * d / (u_radius * u_radius)) * u_strength;
  fragColor = curr + vec4(u_color * spl, spl);
}`;

const FRAG_VEL_INJECT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_vel;
uniform vec2  u_pos;
uniform vec2  u_force;
uniform float u_radius;

void main() {
  vec4  curr = texture(u_vel, v_uv);
  float d    = distance(v_uv, u_pos);
  float w    = exp(-d * d / (u_radius * u_radius));
  fragColor  = curr + vec4(u_force * w, 0.0, 0.0);
}`;

const FRAG_DISPLAY = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_dens;
uniform float u_beat;
uniform vec3  u_colorA;

void main() {
  vec4 d = texture(u_dens, v_uv);
  vec3 col = clamp(d.rgb, 0.0, 1.0);
  col += u_beat * 0.1 * u_colorA;
  fragColor = vec4(col, 1.0);
}`;

const SIM_SIZE = 256;

export class FluidScene extends BaseScene {
  private _advectProg!: WebGLProgram;
  private _injectProg!: WebGLProgram;
  private _velInjectProg!: WebGLProgram;
  private _displayProg!: WebGLProgram;

  private _densA!: { fb: WebGLFramebuffer; tex: WebGLTexture };
  private _densB!: { fb: WebGLFramebuffer; tex: WebGLTexture };
  private _velA!:  { fb: WebGLFramebuffer; tex: WebGLTexture };
  private _velB!:  { fb: WebGLFramebuffer; tex: WebGLTexture };

  private _beatFlash = 0;
  private _frame = 0;

  constructor(renderer: WebGLRenderer) { super(renderer); }

  init(): void {
    this._advectProg    = this.renderer.createProgram(VERT_FULLSCREEN, FRAG_ADVECT);
    this._injectProg    = this.renderer.createProgram(VERT_FULLSCREEN, FRAG_INJECT);
    this._velInjectProg = this.renderer.createProgram(VERT_FULLSCREEN, FRAG_VEL_INJECT);
    this._displayProg   = this.renderer.createProgram(VERT_FULLSCREEN, FRAG_DISPLAY);
    this._densA = this._mkFloat(SIM_SIZE, SIM_SIZE);
    this._densB = this._mkFloat(SIM_SIZE, SIM_SIZE);
    this._velA  = this._mkFloat(SIM_SIZE, SIM_SIZE);
    this._velB  = this._mkFloat(SIM_SIZE, SIM_SIZE);
  }

  update(data: AudioReactorData, _time: number): void {
    if (data.isBeat) { this._beatFlash = 1; this.renderer.onBeat(); }
    this._beatFlash = Math.max(0, this._beatFlash - 0.06);
    this._frame++;
  }

  renderWithTime(data: AudioReactorData, time: number): void {
    const { gl, renderer } = this;

    gl.viewport(0, 0, SIM_SIZE, SIM_SIZE);

    // ── Inject velocity ──
    const angle = time * 0.7;
    const injectPos: [number, number] = [0.5 + Math.cos(angle) * 0.2, 0.5 + Math.sin(angle) * 0.2];
    const force: [number, number] = [Math.sin(angle) * data.bass * 0.3, -Math.cos(angle) * data.bass * 0.3];

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._velB.fb);
    gl.useProgram(this._velInjectProg);
    this._bindSim(this._velInjectProg, 'u_vel', this._velA.tex);
    this._setVec2(this._velInjectProg, 'u_pos', ...injectPos);
    this._setVec2(this._velInjectProg, 'u_force', ...force);
    renderer.setUniform1f(this._velInjectProg, 'u_radius', 0.06 + data.mid * 0.04);
    renderer.drawFullscreenQuad();
    [this._velA, this._velB] = [this._velB, this._velA];

    // Beat explosion
    if (data.isBeat) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._velB.fb);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        this._setVec2(this._velInjectProg, 'u_pos', 0.5, 0.5);
        this._setVec2(this._velInjectProg, 'u_force', Math.cos(a) * 0.5, Math.sin(a) * 0.5);
        renderer.setUniform1f(this._velInjectProg, 'u_radius', 0.15);
        this._bindSim(this._velInjectProg, 'u_vel', this._velA.tex);
        renderer.drawFullscreenQuad();
      }
      [this._velA, this._velB] = [this._velB, this._velA];
    }

    // ── Advect density ──
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._densB.fb);
    gl.useProgram(this._advectProg);
    this._bindSim(this._advectProg, 'u_vel', this._velA.tex);
    this._bindSimSlot(this._advectProg, 'u_dens', this._densA.tex, 1);
    renderer.setUniform2f(this._advectProg, 'u_res', SIM_SIZE, SIM_SIZE);
    renderer.setUniform1f(this._advectProg, 'u_dissipation', 0.992);
    renderer.setUniform1f(this._advectProg, 'u_dt', 12.0);
    renderer.drawFullscreenQuad();
    [this._densA, this._densB] = [this._densB, this._densA];

    // ── Inject color ──
    const col = this._frame % 2 === 0 ? renderer.colorA : renderer.colorB;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._densB.fb);
    gl.useProgram(this._injectProg);
    this._bindSim(this._injectProg, 'u_dens', this._densA.tex);
    this._setVec2(this._injectProg, 'u_pos', ...injectPos);
    gl.uniform3fv(gl.getUniformLocation(this._injectProg, 'u_color'), col);
    renderer.setUniform1f(this._injectProg, 'u_radius', 0.03 + data.bass * 0.02);
    renderer.setUniform1f(this._injectProg, 'u_strength', data.overall * 0.8 + 0.1);
    renderer.drawFullscreenQuad();
    [this._densA, this._densB] = [this._densB, this._densA];

    // ── Display ──
    renderer.bindSceneFB();
    const { width, height } = renderer;
    gl.viewport(0, 0, width, height);
    gl.useProgram(this._displayProg);
    this._bindSim(this._displayProg, 'u_dens', this._densA.tex);
    renderer.setUniform1f(this._displayProg, 'u_beat', this._beatFlash);
    gl.uniform3fv(gl.getUniformLocation(this._displayProg, 'u_colorA'), renderer.colorA);
    renderer.drawFullscreenQuad();
  }

  render(): void {}

  dispose(): void {
    const { gl } = this;
    [this._densA, this._densB, this._velA, this._velB].forEach((f) => {
      if (f) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); }
    });
    [this._advectProg, this._injectProg, this._velInjectProg, this._displayProg].forEach((p) => {
      if (p) gl.deleteProgram(p);
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private _mkFloat(w: number, h: number): { fb: WebGLFramebuffer; tex: WebGLTexture } {
    const { gl } = this;
    const ext = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('OES_texture_float_linear');
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Try RGBA32F first, fall back to RGBA
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    // Check status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      // Fallback to RGBA8
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    void ext; // mark ext as used
    return { fb, tex };
  }

  private _bindSim(prog: WebGLProgram, name: string, tex: WebGLTexture): void {
    this.renderer.bindTexture(prog, name, tex, 0);
  }

  private _bindSimSlot(prog: WebGLProgram, name: string, tex: WebGLTexture, slot: number): void {
    this.renderer.bindTexture(prog, name, tex, slot);
  }

  private _setVec2(prog: WebGLProgram, name: string, x: number, y: number): void {
    const loc = this.gl.getUniformLocation(prog, name);
    if (loc !== null) this.gl.uniform2f(loc, x, y);
  }
}
