'use client';

import { useEffect, useRef } from 'react';
import { WebGLRenderer } from '../../src/lib/visual/WebGLRenderer';
import { audioReactor } from '../../src/lib/visual/AudioReactor';
import { useVisualStore } from '../../src/store/useVisualStore';
import type { SceneName } from '../../src/store/useVisualStore';
import type { BaseScene } from '../../src/lib/visual/scenes/BaseScene';

async function loadScene(name: SceneName, renderer: WebGLRenderer): Promise<BaseScene> {
  switch (name) {
    case 'particle':  { const { ParticleScene }  = await import('../../src/lib/visual/scenes/ParticleScene');  return new ParticleScene(renderer);  }
    case 'geometry':  { const { GeometryScene }  = await import('../../src/lib/visual/scenes/GeometryScene');  return new GeometryScene(renderer);  }
    case 'waveform':  { const { WaveformScene }  = await import('../../src/lib/visual/scenes/WaveformScene');  return new WaveformScene(renderer);  }
    case 'tunnel':    { const { TunnelScene }    = await import('../../src/lib/visual/scenes/TunnelScene');    return new TunnelScene(renderer);    }
    case 'frequency': { const { FrequencyScene } = await import('../../src/lib/visual/scenes/FrequencyScene'); return new FrequencyScene(renderer); }
    case 'fluid':     { const { FluidScene }     = await import('../../src/lib/visual/scenes/FluidScene');     return new FluidScene(renderer);     }
    case 'fractal':   { const { FractalScene }   = await import('../../src/lib/visual/scenes/FractalScene');   return new FractalScene(renderer);   }
    case 'grid':      { const { GridScene }      = await import('../../src/lib/visual/scenes/GridScene');      return new GridScene(renderer);      }
    case 'starfield': { const { StarfieldScene } = await import('../../src/lib/visual/scenes/StarfieldScene'); return new StarfieldScene(renderer); }
    case 'glitch':    { const { GlitchScene }    = await import('../../src/lib/visual/scenes/GlitchScene');    return new GlitchScene(renderer);    }
    case 'lissajous': { const { LissajousScene } = await import('../../src/lib/visual/scenes/LissajousScene'); return new LissajousScene(renderer); }
    case 'custom':    { const { CustomShaderScene } = await import('../../src/lib/visual/scenes/CustomShaderScene'); return new CustomShaderScene(renderer); }
  }
}

export default function VisualOutputPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: WebGLRenderer | null = null;
    let scene: BaseScene | null = null;
    let rafId = 0;
    let channel: BroadcastChannel | null = null;

    try {
      renderer = new WebGLRenderer(canvas);
    } catch {
      console.error('[VisualOutputPage] WebGL2 not available');
      return;
    }

    // Resize to window
    const resize = () => {
      renderer?.resize(window.innerWidth, window.innerHeight);
    };
    resize();
    window.addEventListener('resize', resize);

    // Subscribe to broadcast channel for scene/palette updates
    channel = new BroadcastChannel('visual-sync');
    channel.onmessage = (ev) => {
      if (ev.data?.type === 'config') {
        const state = useVisualStore.getState();
        const pal = state.activePalette();
        if (renderer) {
          renderer.colorA = pal.colorA;
          renderer.colorB = pal.colorB;
          renderer.colorC = pal.colorC;
        }
      }
    };

    // Load initial scene from store
    const sceneName = useVisualStore.getState().activeScene;
    const r = renderer;
    loadScene(sceneName, r).then((s) => {
      s.init();
      scene = s;

      const loop = (now: number) => {
        const time = now / 1000;
        const data = audioReactor.data;
        const state = useVisualStore.getState();
        const pal = state.activePalette();
        const pfx = state.postFX;

        r.colorA = pal.colorA;
        r.colorB = pal.colorB;
        r.colorC = pal.colorC;
        r.postFX.bloom               = pfx.bloom;
        r.postFX.motionBlur          = pfx.motionBlur;
        r.postFX.chromaticAberration = pfx.chromaticAb;
        r.postFX.vignette            = pfx.vignette;
        r.postFX.grain               = pfx.filmGrain;

        r.beginFrame();
        scene?.update(data, time);
        scene?.renderWithTime(data, time);
        r.present(time);

        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    });

    return () => {
      cancelAnimationFrame(rafId);
      scene?.dispose();
      renderer?.dispose();
      channel?.close();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', cursor: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
