'use client';

import { useEffect, useRef, useState } from 'react';
import type { WebGLRenderer } from '../../lib/visual/WebGLRenderer';
import type { SceneName } from '../../store/useVisualStore';
import { BaseScene } from '../../lib/visual/scenes/BaseScene';

// Lazy imports to avoid loading WebGL code server-side
async function loadScene(name: SceneName, renderer: WebGLRenderer): Promise<BaseScene> {
  switch (name) {
    case 'particle':  { const { ParticleScene }  = await import('../../lib/visual/scenes/ParticleScene');  return new ParticleScene(renderer);  }
    case 'geometry':  { const { GeometryScene }  = await import('../../lib/visual/scenes/GeometryScene');  return new GeometryScene(renderer);  }
    case 'waveform':  { const { WaveformScene }  = await import('../../lib/visual/scenes/WaveformScene');  return new WaveformScene(renderer);  }
    case 'tunnel':    { const { TunnelScene }    = await import('../../lib/visual/scenes/TunnelScene');    return new TunnelScene(renderer);    }
    case 'frequency': { const { FrequencyScene } = await import('../../lib/visual/scenes/FrequencyScene'); return new FrequencyScene(renderer); }
    case 'fluid':     { const { FluidScene }     = await import('../../lib/visual/scenes/FluidScene');     return new FluidScene(renderer);     }
    case 'fractal':   { const { FractalScene }   = await import('../../lib/visual/scenes/FractalScene');   return new FractalScene(renderer);   }
    case 'grid':      { const { GridScene }      = await import('../../lib/visual/scenes/GridScene');      return new GridScene(renderer);      }
    case 'starfield': { const { StarfieldScene } = await import('../../lib/visual/scenes/StarfieldScene'); return new StarfieldScene(renderer); }
    case 'glitch':    { const { GlitchScene }    = await import('../../lib/visual/scenes/GlitchScene');    return new GlitchScene(renderer);    }
    case 'lissajous': { const { LissajousScene } = await import('../../lib/visual/scenes/LissajousScene'); return new LissajousScene(renderer); }
    case 'custom':    { const { CustomShaderScene } = await import('../../lib/visual/scenes/CustomShaderScene'); return new CustomShaderScene(renderer); }
  }
}

/**
 * Manages the lifecycle of a single active scene instance.
 * Disposes the old scene and inits the new one when `sceneName` changes.
 */
export function useVisualScene(
  renderer: WebGLRenderer | null,
  sceneName: SceneName,
): BaseScene | null {
  const [scene, setScene] = useState<BaseScene | null>(null);
  const prevScene = useRef<BaseScene | null>(null);

  useEffect(() => {
    if (!renderer) return;

    let cancelled = false;

    loadScene(sceneName, renderer).then((newScene) => {
      if (cancelled) { newScene.dispose(); return; }
      newScene.init();
      // Dispose old scene after init (no GL errors)
      prevScene.current?.dispose();
      prevScene.current = newScene;
      setScene(newScene);
    }).catch((err) => {
      if (!cancelled) console.error('[useVisualScene] Failed to load scene:', err);
    });

    return () => { cancelled = true; };
  }, [renderer, sceneName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      prevScene.current?.dispose();
      prevScene.current = null;
    };
  }, []);

  return scene;
}
