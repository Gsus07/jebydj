'use client';

import type { WebGLRenderer } from '../WebGLRenderer';
import type { AudioReactorData } from '../AudioReactor';

/**
 * Abstract base class for all visual scenes.
 * Scenes render into renderer.sceneFB, which the renderer then composites.
 */
export abstract class BaseScene {
  protected renderer: WebGLRenderer;
  protected gl: WebGL2RenderingContext;

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    this.gl = renderer.gl;
  }

  abstract init(): void;
  abstract update(data: AudioReactorData, time: number): void;
  abstract render(): void;
  /** Render the scene into renderer.sceneFB using the current audio data and time. */
  renderWithTime(_data: AudioReactorData, _time: number): void { this.render(); }
  abstract dispose(): void;
}
