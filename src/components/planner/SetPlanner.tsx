'use client';

import { useCallback, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ListMusic, ChevronRight, ChevronLeft, Plus, Download, Sparkles } from 'lucide-react';
import { useDJStore } from '@/src/store/useDJStore';
import { EnergyCurve, trackEnergy } from './EnergyCurve';
import { SetlistTrack } from './SetlistTrack';
import type { Track } from '@/src/store/types';

export function SetPlanner() {
  const [collapsed, setCollapsed] = useState(false);
  const setlist = useDJStore((s) => s.setlist);
  const library = useDJStore((s) => s.library);
  const {
    removeSetlistEntry,
    reorderSetlist,
    setSetlistVisible,
    addSetlistEntry,
  } = useDJStore.getState();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Resolve track IDs to full track objects
  const setlistTracks: Track[] = setlist.entries
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((e) => library.tracks.find((t) => t.id === e.trackId))
    .filter((t): t is Track => t !== undefined);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = setlistTracks.findIndex((t) => t.id === active.id);
    const toIndex = setlistTracks.findIndex((t) => t.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderSetlist(fromIndex, toIndex);
    }
  }, [setlistTracks, reorderSetlist]);

  const handleAddNext = useCallback(() => {
    // Find a track not already in setlist with compatible BPM/key
    const lastTrack = setlistTracks[setlistTracks.length - 1];
    const inSetlist = new Set(setlist.entries.map((e) => e.trackId));
    const candidates = library.tracks.filter((t) => !inSetlist.has(t.id));

    if (candidates.length === 0) return;

    let best: Track | null = null;
    if (lastTrack) {
      // Score candidates by BPM closeness (±8%) and energy arc (slight increase)
      const lastEnergy = trackEnergy(lastTrack);
      best = candidates.reduce<Track | null>((acc, t) => {
        const bpmDiff = Math.abs(t.bpm - lastTrack.bpm) / Math.max(1, lastTrack.bpm);
        if (bpmDiff > 0.08) return acc; // outside ±8% range
        if (!acc) return t;
        const accDiff = Math.abs(trackEnergy(acc) - (lastEnergy + 0.5));
        const tDiff = Math.abs(trackEnergy(t) - (lastEnergy + 0.5));
        return tDiff < accDiff ? t : acc;
      }, null);
    }

    addSetlistEntry((best ?? candidates[0]).id);
  }, [setlistTracks, setlist.entries, library.tracks, addSetlistEntry]);

  const handleExport = useCallback(() => {
    const lines = setlistTracks.map((t, i) =>
      `${i + 1}. ${t.artist ? `${t.artist} - ` : ''}${t.title || t.fileName}  BPM:${t.bpm.toFixed(0)}  Key:${t.key}`
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'setlist.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [setlistTracks]);

  const handleLoadToDeck = useCallback((track: Track, deck: 'A' | 'B') => {
    // Use store to set deck track — deck loading is handled by useDeck hook
    // We dispatch a custom event that the deck can pick up
    window.dispatchEvent(new CustomEvent('jeby:loadToDeck', { detail: { trackId: track.id, deck } }));
  }, []);

  return (
    <div
      className="flex flex-col h-full transition-all duration-300 overflow-hidden"
      style={{
        width: collapsed ? 28 : 300,
        backgroundColor: '#111118',
        borderLeft: '1px solid #2a2a3a',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-[#2a2a3a] flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            <ListMusic size={13} style={{ color: '#ffbe0b' }} />
            <span className="text-[10px] font-orbitron font-bold text-white">SET PLANNER</span>
            <span className="text-[8px] font-orbitron text-muted">({setlistTracks.length})</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted hover:text-white ml-auto"
        >
          {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Energy curve */}
          <div className="px-2 pt-2 flex-shrink-0">
            <div className="text-[8px] font-rajdhani text-muted mb-1">ENERGY ARC</div>
            <EnergyCurve
              tracks={setlistTracks}
              playingIndex={setlist.playingIndex}
              width={280}
              height={80}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 px-2 py-2 flex-shrink-0">
            <button
              onClick={handleAddNext}
              className="flex items-center gap-1 px-2 py-1 rounded border border-[#ffbe0b44] text-[#ffbe0b] text-[9px] font-orbitron hover:bg-[#ffbe0b22]"
            >
              <Sparkles size={9} />ADD NEXT
            </button>
            <button
              onClick={handleExport}
              disabled={setlistTracks.length === 0}
              className="flex items-center gap-1 px-2 py-1 rounded border border-[#2a2a3a] text-muted text-[9px] font-orbitron hover:text-white disabled:opacity-40"
            >
              <Download size={9} />EXPORT
            </button>
          </div>

          {/* Sortable list */}
          <div className="flex-1 overflow-y-auto px-1">
            {setlistTracks.length === 0 ? (
              <div className="text-[9px] font-rajdhani text-muted text-center mt-4 px-4">
                Right-click tracks in the library to add them to your set
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={setlistTracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {setlistTracks.map((track, i) => (
                    <SetlistTrack
                      key={track.id}
                      track={track}
                      index={i}
                      isPlaying={i === setlist.playingIndex}
                      onRemove={() => removeSetlistEntry(track.id)}
                      onLoadToDeck={(deck) => handleLoadToDeck(track, deck)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
