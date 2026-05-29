'use client';

import React from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import type { DAWTrack, SceneRow } from '@/src/store/dawTypes';
import { Play, Square, Circle } from 'lucide-react';

interface ClipCellProps {
  track: DAWTrack;
  scene: SceneRow;
  sceneIndex: number;
}

export default function ClipCell({ track, scene, sceneIndex }: ClipCellProps) {
  const store = useDAWStore();

  // Find clip assigned to this scene slot
  const clipId = track.clips[sceneIndex]?.id ?? null;
  const clip = clipId ? track.clips.find((c) => c.id === clipId) : null;
  const isActive = store.activeSessionClips[track.id] === clipId;
  const isPlaying = clip?.isPlaying ?? false;

  const handleClick = () => {
    if (!clip) {
      // Empty cell — create a new clip here
      store.pushHistory('Add session clip');
      if (track.type === 'midi') {
        store.addClip(track.id, sceneIndex * 8, 'midi');
      } else {
        store.addClip(track.id, sceneIndex * 8, 'audio');
      }
      return;
    }

    if (isActive) {
      store.setActiveSessionClip(track.id, null);
    } else {
      store.setActiveSessionClip(track.id, clipId);
    }
  };

  return (
    <div
      className="flex items-center justify-center rounded cursor-pointer transition-all duration-100 select-none border"
      style={{
        width: 80,
        height: 56,
        background: clip
          ? isActive
            ? `${track.color}33`
            : 'var(--bg-card)'
          : 'var(--bg-primary)',
        borderColor: clip
          ? isActive
            ? track.color
            : `${track.color}55`
          : 'var(--border)',
      }}
      onClick={handleClick}
      title={clip ? clip.name : 'Empty — click to add clip'}
    >
      {clip ? (
        <div className="flex flex-col items-center gap-0.5">
          <div
            className="flex items-center justify-center w-6 h-6 rounded-full"
            style={{ background: isActive ? track.color : 'transparent', border: `1px solid ${track.color}` }}
          >
            {isActive
              ? <Square size={8} fill={isActive ? '#000' : track.color} />
              : <Play size={8} style={{ color: track.color }} />}
          </div>
          <div className="text-[9px] truncate max-w-[70px] text-center" style={{ color: 'var(--text-muted)' }}>
            {clip.name}
          </div>
        </div>
      ) : (
        <div
          className="w-5 h-5 rounded-full border border-dashed flex items-center justify-center"
          style={{ borderColor: 'var(--border)' }}
        >
          <Circle size={6} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        </div>
      )}
    </div>
  );
}
