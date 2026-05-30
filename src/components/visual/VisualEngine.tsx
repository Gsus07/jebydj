'use client';

import { useState } from 'react';
import { VisualOutput } from './VisualOutput';
import { SceneSelector } from './SceneSelector';
import { ColorPalette } from './ColorPalette';
import { VisualControls } from './VisualControls';
import { BeatDetector } from './BeatDetector';
import { ProjectorOutput } from './ProjectorOutput';
import { useVisualStore } from '../../store/useVisualStore';

type Tab = 'scenes' | 'colors' | 'fx';

export function VisualEngine() {
  const [tab, setTab] = useState<Tab>('scenes');
  const [showPanel, setShowPanel] = useState(true);
  const { mode, setMode } = useVisualStore();

  const isFullscreen = mode === 'fullscreen';

  return (
    <div
      className={[
        'flex flex-col bg-black border border-white/10 rounded-lg overflow-hidden',
        isFullscreen ? 'fixed inset-0 z-50' : 'relative',
      ].join(' ')}
      style={!isFullscreen ? { height: 'clamp(180px, 28vh, 320px)' } : undefined}
    >
      {/* ── Canvas ── */}
      <div className="flex-1 min-h-0 relative">
        <VisualOutput className="absolute inset-0" />

        {/* Overlay toolbar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-2 py-1 bg-gradient-to-b from-black/70 to-transparent">
          <BeatDetector />

          <div className="flex items-center gap-1">
            <ProjectorOutput />
            <button
              onClick={() => setMode(isFullscreen ? 'embedded' : 'fullscreen')}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? '⊡' : '⊞'}
            </button>
            <button
              onClick={() => setShowPanel((v) => !v)}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-gray-400 hover:bg-white/10"
              title="Toggle controls"
            >
              {showPanel ? '▴' : '▾'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Control panel ── */}
      {showPanel && (
        <div className="shrink-0 border-t border-white/10 bg-[#0a0a0a]">
          {/* Tab bar */}
          <div className="flex border-b border-white/10">
            {(['scenes', 'colors', 'fx'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  'flex-1 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors',
                  tab === t
                    ? 'text-cyan-400 border-b border-cyan-400'
                    : 'text-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                {t === 'scenes' ? 'Scenes' : t === 'colors' ? 'Colors' : 'FX'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="overflow-y-auto" style={{ maxHeight: 160 }}>
            {tab === 'scenes' && <SceneSelector />}
            {tab === 'colors' && <ColorPalette />}
            {tab === 'fx'     && <VisualControls />}
          </div>
        </div>
      )}
    </div>
  );
}
