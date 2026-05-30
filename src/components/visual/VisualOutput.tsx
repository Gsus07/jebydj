'use client';

import { useEffect, useRef, useState } from 'react';
import { WebGLRenderer } from '../../lib/visual/WebGLRenderer';
import { audioReactor } from '../../lib/visual/AudioReactor';
import { useVisualScene } from '../../hooks/visual/useVisualScene';
import { useVisualStore } from '../../store/useVisualStore';
import type { AudioReactorData } from '../../lib/visual/AudioReactor';

interface VisualOutputProps {
  className?: string;
  /** Broadcast channel to send rendered frames to projector window */
  broadcast?: boolean;
}

export function VisualOutput({ className = '', broadcast = false }: VisualOutputProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null);

  const { activeScene } = useVisualStore();
  const scene = useVisualScene(renderer, activeScene);

  // ── Init renderer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let r: WebGLRenderer | null = null;
    try {
      r = new WebGLRenderer(canvas);
      rendererRef.current = r;
      setRenderer(r);
    } catch (e) {
      console.error('[VisualOutput] WebGL2 init failed:', e);
      return;
    }

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      r?.resize(Math.round(width), Math.round(height));
    });
    ro.observe(canvas.parentElement ?? canvas);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      r?.dispose();
      rendererRef.current = null;
      setRenderer(null);
    };
  }, []);

  // ── Broadcast channel for projector ──────────────────────────────────────
  useEffect(() => {
    if (!broadcast) return;
    const ch = new BroadcastChannel('visual-sync');
    channelRef.current = ch;
    return () => { ch.close(); channelRef.current = null; };
  }, [broadcast]);

  // ── rAF render loop ───────────────────────────────────────────────────────
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !scene) return;

    let startTime = performance.now();

    const loop = (now: number) => {
      const time = (now - startTime) / 1000;
      const data: AudioReactorData = audioReactor.data;

      // Sync palette & postFX every frame (cheap)
      const pal = useVisualStore.getState().activePalette();
      r.colorA = pal.colorA;
      r.colorB = pal.colorB;
      r.colorC = pal.colorC;
      const pfx = useVisualStore.getState().postFX;
      r.postFX.bloom               = pfx.bloom;
      r.postFX.motionBlur          = pfx.motionBlur;
      r.postFX.chromaticAberration = pfx.chromaticAb;
      r.postFX.vignette            = pfx.vignette;
      r.postFX.grain               = pfx.filmGrain;

      r.beginFrame();
      scene.update(data, time);
      scene.renderWithTime(data, time);
      r.present(time);

      // Projector broadcast via BroadcastChannel (send canvas data URL at low rate)
      // Full 60fps image transfer is too heavy; only send metadata for scenes
      if (channelRef.current) {
        channelRef.current.postMessage({ type: 'frame', time, data: {
          bass: data.bass, mid: data.mid, high: data.high,
          beat: data.isBeat, overall: data.overall,
        }});
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scene]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
    />
  );
}
