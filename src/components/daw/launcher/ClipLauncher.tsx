'use client';

import React from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import ClipCell from './ClipCell';
import { Plus, Play } from 'lucide-react';

export default function ClipLauncher() {
  const store = useDAWStore();
  const { project } = store;
  const audioTracks = project.tracks.filter((t) => t.type === 'audio' || t.type === 'midi');

  return (
    <div
      className="flex flex-col flex-1 overflow-auto"
      style={{ background: 'var(--bg-primary)', fontFamily: 'var(--font-rajdhani)' }}
    >
      {/* Header row (track names) */}
      <div
        className="flex items-stretch shrink-0 border-b sticky top-0 z-10"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        {/* Scene label spacer */}
        <div style={{ width: 90, borderRight: '1px solid var(--border)' }} className="flex items-center px-2">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Scenes</span>
        </div>

        {/* Track headers */}
        {audioTracks.map((track) => (
          <div
            key={track.id}
            className="flex flex-col items-center justify-center px-2 border-r"
            style={{ width: 88, borderColor: 'var(--border)', borderTop: `2px solid ${track.color}` }}
          >
            <div
              className="w-2 h-2 rounded-full mb-1"
              style={{ background: track.color }}
            />
            <div className="text-[10px] font-semibold truncate max-w-full" style={{ color: 'var(--text-primary)' }}>
              {track.name}
            </div>
          </div>
        ))}

        {/* Add track */}
        <button
          className="flex items-center justify-center px-3 opacity-40 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => { store.pushHistory('Add audio track'); store.addTrack('audio'); }}
          title="Add track"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Scene rows */}
      {project.scenes.map((scene, sceneIndex) => (
        <div
          key={scene.id}
          className="flex items-stretch border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Scene label + launch */}
          <div
            className="flex items-center justify-between px-2 shrink-0 border-r"
            style={{ width: 90, borderColor: 'var(--border)' }}
          >
            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {scene.name}
            </span>
            <button
              className="flex items-center justify-center w-6 h-6 rounded-full transition-all hover:scale-110"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--accent-cyan)',
              }}
              onClick={() => {
                // Launch all clips in this scene
                audioTracks.forEach((track) => {
                  const clip = track.clips[sceneIndex];
                  if (clip) store.setActiveSessionClip(track.id, clip.id);
                });
              }}
              title={`Launch ${scene.name}`}
            >
              <Play size={10} />
            </button>
          </div>

          {/* Clip cells */}
          {audioTracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-center p-1 border-r"
              style={{ width: 88, borderColor: 'var(--border)' }}
            >
              <ClipCell track={track} scene={scene} sceneIndex={sceneIndex} />
            </div>
          ))}
        </div>
      ))}

      {/* Add scene */}
      <button
        className="flex items-center gap-2 px-4 py-2 opacity-40 hover:opacity-70 transition-opacity text-sm"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => { store.pushHistory('Add scene'); store.addScene(); }}
      >
        <Plus size={12} /> Add Scene
      </button>
    </div>
  );
}
