'use client';

import React from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import type { DAWTrack, PluginType } from '@/src/store/dawTypes';
import EQPlugin from './EQPlugin';
import CompressorPlugin from './CompressorPlugin';
import { X, Power, Plus } from 'lucide-react';

interface PluginRackProps {
  trackId: string;
  onClose: () => void;
}

export default function PluginRack({ trackId, onClose }: PluginRackProps) {
  const store = useDAWStore();
  const track = store.project.tracks.find((t) => t.id === trackId);
  const activePluginId = store.activePluginTrackId === trackId ? store.activePluginId : null;

  if (!track) return null;

  const pluginLabel: Record<PluginType, string> = {
    eq8: 'EQ8',
    compressor: 'Compressor',
    limiter: 'Limiter',
    chorus: 'Chorus',
    gate: 'Gate',
    pitchCorrector: 'Pitch',
    stereoWidener: 'Stereo',
    saturator: 'Saturator',
    transientShaper: 'Transient',
  };

  return (
    <div
      className="flex flex-col"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        width: 280,
        fontFamily: 'var(--font-rajdhani)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--border)', borderTop: `2px solid ${track.color}` }}
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
          {track.name} — Plugins
        </span>
        <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10">
          <X size={12} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Plugin slots */}
      <div className="flex flex-col gap-1 p-2">
        {track.plugins.map((plugin) => (
          <div key={plugin.id}>
            {/* Plugin slot header */}
            <div
              className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors"
              style={{
                background: activePluginId === plugin.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: `1px solid ${activePluginId === plugin.id ? 'var(--border)' : 'transparent'}`,
              }}
              onClick={() => store.setActivePlugin(
                activePluginId === plugin.id ? null : trackId,
                activePluginId === plugin.id ? null : plugin.id,
              )}
            >
              {/* Power button */}
              <button
                className="w-4 h-4 flex items-center justify-center shrink-0"
                style={{ color: plugin.enabled ? 'var(--accent-cyan)' : 'var(--text-muted)' }}
                onClick={(e) => { e.stopPropagation(); store.togglePlugin(trackId, plugin.id); }}
                title={plugin.enabled ? 'Bypass' : 'Enable'}
              >
                <Power size={10} />
              </button>

              <span className="flex-1 text-xs" style={{ color: plugin.enabled ? 'var(--text-primary)' : 'var(--text-muted)', opacity: plugin.enabled ? 1 : 0.5 }}>
                {pluginLabel[plugin.type] ?? plugin.type}
              </span>

              {/* Remove */}
              <button
                className="w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:!opacity-100"
                style={{ color: 'var(--text-muted)' }}
                onClick={(e) => { e.stopPropagation(); store.removePlugin(trackId, plugin.id); }}
                title="Remove plugin"
              >
                <X size={8} />
              </button>
            </div>

            {/* Plugin editor panel */}
            {activePluginId === plugin.id && (
              <div
                className="rounded mt-1 mb-1 border overflow-hidden"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
              >
                {plugin.type === 'eq8' && <EQPlugin trackId={trackId} pluginId={plugin.id} />}
                {plugin.type === 'compressor' && <CompressorPlugin trackId={trackId} pluginId={plugin.id} />}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add plugin */}
      <div className="p-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <select
          className="w-full text-xs rounded px-2 h-7 outline-none cursor-pointer"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          defaultValue=""
          onChange={(e) => {
            const type = e.target.value as PluginType;
            if (type) {
              store.pushHistory(`Add ${type} plugin`);
              store.addPlugin(trackId, type);
              e.target.value = '';
            }
          }}
        >
          <option value="" disabled>+ Add plugin…</option>
          <option value="eq8">EQ8</option>
          <option value="compressor">Compressor</option>
          <option value="limiter">Limiter</option>
          <option value="chorus">Chorus</option>
          <option value="gate">Gate</option>
          <option value="saturator">Saturator</option>
        </select>
      </div>
    </div>
  );
}
