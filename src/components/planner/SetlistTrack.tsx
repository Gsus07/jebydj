'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Plus } from 'lucide-react';
import type { Track } from '@/src/store/types';
import { trackEnergy } from './EnergyCurve';
import { formatTimeShort } from '@/src/lib/utils/formatTime';

interface SetlistTrackProps {
  track: Track;
  index: number;
  isPlaying: boolean;
  onRemove: () => void;
  onLoadToDeck: (deck: 'A' | 'B') => void;
}

export function SetlistTrack({ track, index, isPlaying, onRemove, onLoadToDeck }: SetlistTrackProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  const energy = trackEnergy(track);
  const energyColor =
    energy <= 4 ? '#06d6a0' :
    energy <= 7 ? '#ffbe0b' :
    '#ff6a00';

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isPlaying ? '#1a1a2e' : 'transparent',
        borderLeft: isPlaying ? '2px solid #00f5ff' : '2px solid transparent',
      }}
      className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#1a1a24] transition-colors"
    >
      {/* Drag handle */}
      <div {...attributes} {...listeners} className="cursor-grab text-muted hover:text-white flex-shrink-0">
        <GripVertical size={12} />
      </div>

      {/* Order number */}
      <span className="text-[9px] font-orbitron text-muted w-4 flex-shrink-0">{index + 1}</span>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-rajdhani font-semibold truncate" style={{ color: isPlaying ? '#00f5ff' : '#e8e8f0' }}>
          {track.title || track.fileName}
        </div>
        <div className="text-[8px] font-rajdhani text-muted">{track.artist}</div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 flex-shrink-0 text-[8px] font-orbitron">
        <span className="text-muted">{track.bpm > 0 ? track.bpm.toFixed(0) : '--'}</span>
        <span style={{ color: '#8338ec' }}>{track.key || '---'}</span>
        <span className="text-muted">{track.duration > 0 ? formatTimeShort(track.duration) : '--:--'}</span>

        {/* Energy bar */}
        <div className="flex items-center gap-1">
          <div
            className="h-1.5 rounded"
            style={{ width: `${energy * 4}px`, backgroundColor: energyColor }}
          />
          <span style={{ color: energyColor }}>{energy.toFixed(1)}</span>
        </div>
      </div>

      {/* Actions (hover) */}
      <div className="hidden group-hover:flex items-center gap-1">
        <button
          onClick={() => onLoadToDeck('A')}
          className="text-[7px] font-orbitron px-1 py-0.5 rounded border border-[#00f5ff44] text-[#00f5ff] hover:bg-[#00f5ff22]"
        >A</button>
        <button
          onClick={() => onLoadToDeck('B')}
          className="text-[7px] font-orbitron px-1 py-0.5 rounded border border-[#ff006e44] text-[#ff006e] hover:bg-[#ff006e22]"
        >B</button>
        <button
          onClick={onRemove}
          className="text-muted hover:text-red-400"
        ><X size={10} /></button>
      </div>
    </div>
  );
}
