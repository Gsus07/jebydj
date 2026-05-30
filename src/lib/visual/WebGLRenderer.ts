'use client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PostFX {
  bloom: number;               // 0–1
  motionBlur: number;          // 0–1
  chromaticAberration: number; // 0–1
  vignette: number;            // 0–1
  grain: number;               // 0–1
}

export type BlendMode = 'normal' | 'add' | 'screen' | 'multiply' | 'overlay';

export interface LayerConfig {
  opacity: number;
  blend: BlendMode;
}

// ─── GLSL helpers ────────────────────────────────────────────────────────────

const VERT_QUAD = `#version 300 es
precision mediump float;
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Post-processing: composite scene + bloom + effects
const FRAG_COMPOSITE = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_scene;
uniform sampler2D u_prev;
uniform sampler2D u_bloom;

uniform float u_motionBlur;
uniform float u_bloomAmt;
uniform float u_chromatic;
uniform float u_vignette;
uniform float u_grain;
uniform float u_time;
uniform float u_beat;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;

  // Chromatic aberration
  float ca = u_chromatic * 0.008;
  vec2 dir = uv - 0.5;
  vec4 r = texture(u_scene, uv + dir * ca);
  vec4 g = texture(u_scene, uv);
  vec4 b = texture(u_scene, uv - dir * ca);
  vec4 col = vec4(r.r, g.g, b.b, 1.0);

  // Motion blur (blend with previous frame)
  vec4 prev = texture(u_prev, uv);
  col = mix(col, prev, u_motionBlur * 0.7);

  // Bloom add
  col.rgb += texture(u_bloom, uv).rgb * u_bloomAmt;

  // Beat flash
  col.rgb += u_beat * 0.08;

  // Vignette
  float vd = length((uv - 0.5) * 2.0);
  col.rgb *= 1.0 - u_vignette * smoothstep(0.4, 1.3, vd);

  // Film grain
  float noise = rand(uv + fract(u_time * 0.01)) * 2.0 - 1.0;
  col.rgb += noise * u_grain * 0.04;

  fragColor = clamp(col, 0.0, 1.0);
}`;

// Bloom — bright pass
const FRAG_BLOOM_BRIGHT = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_tex;
uniform float u_threshold;
void main() {
  vec4 c = texture(u_tex, v_uv);
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  fragColor = c * step(u_threshold, lum);
}`;

// Bloom — Gaussian blur (separable)
const FRAG_BLOOM_BLUR = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_tex;
uniform vec2 u_dir;
uniform vec2 u_res;
void main() {
  vec2 step = u_dir / u_res;
  vec4 c = vec4(0.0);
  float w[5];
  w[0]=0.227027; w[1]=0.194595; w[2]=0.121622; w[3]=0.054054; w[4]=0.016216;
  c += texture(u_tex, v_uv) * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture(u_tex, v_uv + float(i) * step) * w[i];
    c += texture(u_tex, v_uv - float(i) * step) * w[i];
  }
  fragColor = c;
}`;

// ─── WebGLRenderer ────────────────────────────────────────────────────────────

export class WebGLRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly canvas: HTMLCanvasElement;

  private _fb0!: { fb: WebGLFramebuffer; tex: WebGLTexture };
  private _fb1!: { fb: WebGLFramebuffer; tex: WebGLTexture };
  private _bloomFbA!: { fb: WebGLFramebuffer; tex: WebGLTexture };
  private _bloomFbB!: { fb: WebGLFramebuffer; tex: WebGLTexture };

  private _quadVAO!: WebGLVertexArrayObject;
  private _compositeProg!: WebGLProgram;
  private _bloomBrightProg!: WebGLProgram;
  private _bloomBlurProg!: WebGLProgram;

  private _w = 0;
  private _h = 0;
  private _ping = true;          // which fb is "current"
  private _beatFlash = 0;        // decays to 0 after a beat

  postFX: PostFX = { bloom: 0.4, motionBlur: 0.3, chromaticAberration: 0.2, vignette: 0.5, grain: 0.1 };
  colorA: [number, number, number] = [0, 0.96, 1.0];
  colorB: [number, number, number] = [1.0, 0, 0.43];
  colorC: [number, number, number] = [1.0, 0.75, 0.04];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;
    this._init();
    this.resize(canvas.width || 800, canvas.height || 600);
  }

  // ── Framebuffer the scene should render into ─────────────────────────────

  get sceneFB(): WebGLFramebuffer { return (this._ping ? this._fb0 : this._fb1).fb; }
  /** Previous frame texture (for feedback/motion-blur) */
  get prevTex(): WebGLTexture    { return (this._ping ? this._fb1 : this._fb0).tex; }
  get width(): number            { return this._w; }
  get height(): number           { return this._h; }

  // ── Public API ────────────────────────────────────────────────────────────

  resize(w: number, h: number): void {
    if (w === this._w && h === this._h) return;
    this._w = w; this._h = h;
    this.canvas.width = w; this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    this._fb0 = this._createFB(w, h);
    this._fb1 = this._createFB(w, h);
    this._bloomFbA = this._createFB(w >> 1, h >> 1);
    this._bloomFbB = this._createFB(w >> 1, h >> 1);
  }

  beginFrame(): void {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFB);
    gl.viewport(0, 0, this._w, this._h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  onBeat(): void { this._beatFlash = 1; }

  /** Apply post-fx and present to screen canvas */
  present(time: number): void {
    const { gl, postFX } = this;

    // 1. Bloom bright pass
    if (postFX.bloom > 0.01) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._bloomFbA.fb);
      gl.viewport(0, 0, this._w >> 1, this._h >> 1);
      gl.useProgram(this._bloomBrightProg);
      this._setUniform1f(this._bloomBrightProg, 'u_threshold', 0.55);
      this._bindTex(this._bloomBrightProg, 'u_tex', this._currentTex(), 0);
      this._drawQuad();

      // Horizontal blur
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._bloomFbB.fb);
      gl.useProgram(this._bloomBlurProg);
      this._setUniform2f(this._bloomBlurProg, 'u_dir', 1, 0);
      this._setUniform2f(this._bloomBlurProg, 'u_res', this._w >> 1, this._h >> 1);
      this._bindTex(this._bloomBlurProg, 'u_tex', this._bloomFbA.tex, 0);
      this._drawQuad();

      // Vertical blur back to A
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._bloomFbA.fb);
      this._setUniform2f(this._bloomBlurProg, 'u_dir', 0, 1);
      this._bindTex(this._bloomBlurProg, 'u_tex', this._bloomFbB.tex, 0);
      this._drawQuad();
    }

    // 2. Composite to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this._w, this._h);
    gl.useProgram(this._compositeProg);

    this._bindTex(this._compositeProg, 'u_scene', this._currentTex(), 0);
    this._bindTex(this._compositeProg, 'u_prev',  this.prevTex, 1);
    this._bindTex(this._compositeProg, 'u_bloom', this._bloomFbA.tex, 2);

    this._setUniform1f(this._compositeProg, 'u_motionBlur',  postFX.motionBlur);
    this._setUniform1f(this._compositeProg, 'u_bloomAmt',    postFX.bloom);
    this._setUniform1f(this._compositeProg, 'u_chromatic',   postFX.chromaticAberration);
    this._setUniform1f(this._compositeProg, 'u_vignette',    postFX.vignette);
    this._setUniform1f(this._compositeProg, 'u_grain',       postFX.grain);
    this._setUniform1f(this._compositeProg, 'u_time',        time);
    this._setUniform1f(this._compositeProg, 'u_beat',        this._beatFlash);
    this._drawQuad();

    // Decay beat flash
    this._beatFlash = Math.max(0, this._beatFlash - 0.1);

    // Swap ping-pong
    this._ping = !this._ping;
  }

  dispose(): void {
    const { gl } = this;
    [this._fb0, this._fb1, this._bloomFbA, this._bloomFbB].forEach((f) => {
      if (f) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); }
    });
    gl.deleteVertexArray(this._quadVAO);
    [this._compositeProg, this._bloomBrightProg, this._bloomBlurProg].forEach((p) => {
      if (p) gl.deleteProgram(p);
    });
  }

  // ── Shader helpers (public for scenes) ───────────────────────────────────

  createProgram(vertSrc: string, fragSrc: string): WebGLProgram {
    const { gl } = this;
    const vert = this._compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = this._compileShader(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(`Shader link error: ${err}`);
    }
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return prog;
  }

  /** Attempt to compile a custom shader. Returns [program, errorString|null] */
  tryCreateProgram(vertSrc: string, fragSrc: string): [WebGLProgram | null, string | null] {
    try {
      return [this.createProgram(vertSrc, fragSrc), null];
    } catch (e) {
      return [null, String(e)];
    }
  }

  bindSceneFB(): void {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFB);
    gl.viewport(0, 0, this._w, this._h);
  }

  drawFullscreenQuad(): void { this._drawQuad(); }

  createTexture(width: number, height: number, data?: Uint8Array): WebGLTexture {
    const { gl } = this;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data ?? null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  updateTexture1D(tex: WebGLTexture, data: Float32Array): void {
    const { gl } = this;
    const buf = new Uint8Array(data.length * 4);
    for (let i = 0; i < data.length; i++) {
      const v = Math.floor(Math.max(0, Math.min(1, data[i])) * 255);
      buf[i * 4] = v; buf[i * 4 + 1] = v; buf[i * 4 + 2] = v; buf[i * 4 + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, data.length, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  }

  setUniforms(prog: WebGLProgram, time: number, bass: number, mid: number, high: number, beat: number, beatPhase: number, overall: number): void {
    this._setUniform1f(prog, 'u_time', time);
    this._setUniform1f(prog, 'u_bass', bass);
    this._setUniform1f(prog, 'u_mid', mid);
    this._setUniform1f(prog, 'u_high', high);
    this._setUniform1f(prog, 'u_beat', beat);
    this._setUniform1f(prog, 'u_beatPhase', beatPhase);
    this._setUniform1f(prog, 'u_overall', overall);
    this._setUniform2f(prog, 'u_resolution', this._w, this._h);
    this.gl.uniform3fv(this.gl.getUniformLocation(prog, 'u_colorA'), this.colorA);
    this.gl.uniform3fv(this.gl.getUniformLocation(prog, 'u_colorB'), this.colorB);
    this.gl.uniform3fv(this.gl.getUniformLocation(prog, 'u_colorC'), this.colorC);
  }

  setUniform1f(prog: WebGLProgram, name: string, v: number): void { this._setUniform1f(prog, name, v); }
  setUniform2f(prog: WebGLProgram, name: string, x: number, y: number): void { this._setUniform2f(prog, name, x, y); }
  bindTexture(prog: WebGLProgram, name: string, tex: WebGLTexture, unit: number): void { this._bindTex(prog, name, tex, unit); }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _init(): void {
    this._setupQuad();
    this._compositeProg   = this.createProgram(VERT_QUAD, FRAG_COMPOSITE);
    this._bloomBrightProg = this.createProgram(VERT_QUAD, FRAG_BLOOM_BRIGHT);
    this._bloomBlurProg   = this.createProgram(VERT_QUAD, FRAG_BLOOM_BLUR);
  }

  private _setupQuad(): void {
    const { gl } = this;
    const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    this._quadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this._quadVAO);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = 0; // a_pos at location 0
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  private _createFB(w: number, h: number): { fb: WebGLFramebuffer; tex: WebGLTexture } {
    const { gl } = this;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { fb, tex };
  }

  private _compileShader(type: number, src: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${err}\n\nSource:\n${src}`);
    }
    return shader;
  }

  private _currentTex(): WebGLTexture {
    return (this._ping ? this._fb0 : this._fb1).tex;
  }

  private _drawQuad(): void {
    const { gl } = this;
    gl.bindVertexArray(this._quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  private _setUniform1f(prog: WebGLProgram, name: string, v: number): void {
    const loc = this.gl.getUniformLocation(prog, name);
    if (loc !== null) this.gl.uniform1f(loc, v);
  }

  private _setUniform2f(prog: WebGLProgram, name: string, x: number, y: number): void {
    const loc = this.gl.getUniformLocation(prog, name);
    if (loc !== null) this.gl.uniform2f(loc, x, y);
  }

  private _bindTex(prog: WebGLProgram, name: string, tex: WebGLTexture, unit: number): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const loc = gl.getUniformLocation(prog, name);
    if (loc !== null) gl.uniform1i(loc, unit);
  }
}

// ── Shared vertex shader for full-screen scenes ──────────────────────────────
export const VERT_FULLSCREEN = VERT_QUAD;
