'use client';

import React, { useState, useCallback } from 'react';
import { Music, RefreshCw, Repeat, Star, Pin } from 'lucide-react';
import { WaveformThumb } from './WaveformThumb';
import { FavoritesStar } from './FavoritesStar';
import type { SampleItem } from '@/src/store/sampleTypes';
import { useSampleStore } from '@/src/store/useSampleStore';
import { sampleManager } from '@/src/lib/samples/SampleManager';
import { useDJStore } from '@/src/store/useDJStore';
import { useDAWStore } from '@/src/store/useDAWStore';
import { storeAudioBuffer } from '@/src/lib/daw/DAWEngine';

const TYPE_ICON: Record<SampleItem['type'], React.ReactNode> = {
  'one-shot': <Music size={9} />,
  'loop':     <Repeat size={9} />,
  'fx':       <RefreshCw size={9} />,
};

export const CATEGORY_COLORS: Record<string, string> = {
  kicks: '#ff006e', snares: '#ff4400', hihat: '#ffbe0b', cymbals: '#ffdd44',
  toms: '#ff8800', percussion: '#aa44ff', 'drum-loops': '#ff006e',
  '808s': '#00f5ff', 'bass-drops': '#0088ff', 'sub-hits': '#0055ff', 'bass-loops': '#00aaff',
  drops: '#ff0055', rises: '#00ff88', downlifters: '#00ccff', sweeps: '#ff44ff',
  vinyl: '#aaaaaa', crowd: '#88aa00', noise: '#666666',
  'chord-loops': '#44ff88', 'melody-loops': '#00ffcc', 'vocal-chops': '#ffaaff',
  'piano-shots': '#ffffff', 'synth-shots': '#aaffff', 'strings-shots': '#ffddaa',
  user: '#888888', favorites: '#ffbe0b', recent: '#00cc44', all: '#888888',
};

/** Warm up the DAW buffer cache for a sample asynchronously */
async function preloadDawBuffer(sampleId: string): Promise<void> {
  const buf = await sampleManager.getOrDecodeBuffer(sampleId);
  if (buf) storeAudioBuffer(sampleId, buf);
}

interface Props {
  sample: SampleItem;
  isSelected: boolean;
  isPreview: boolean;
  previewProgress: number;
  dawMode?: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  style?: React.CSSProperties;
}

export function SampleRow({ sample, isSelected, isPreview, previewProgress, dawMode = false, onClick, onDoubleClick, style }: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const sampleStore = useSampleStore.getState();
  const djStore = useDJStore.getState();

  // Armed sample state (reactive)
  const armedSampleId = useDAWStore((s) => s.armedSample?.id ?? null);
  const shortcutKey = useDAWStore((s) => {
    const entry = Object.entries(s.sampleShortcuts).find(([, id]) => id === sample.id);
    return entry ? parseInt(entry[0]) : null;
  });
  const isArmed = armedSampleId === sample.id;

  const catColor = CATEGORY_COLORS[sample.category] ?? '#888888';

  const sendToDeck = useCallback((deck: 'A' | 'B') => {
    setContextMenu(null);
    sampleStore.incrementUsage(sample.id);
    djStore.setDeckTrack(deck, { trackName: sample.name, bpm: sample.bpm ?? 120 });
  }, [sample, sampleStore, djStore]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const addToDrumMachine = (rowIndex?: number) => {
    setContextMenu(null);
    const { dm } = useSampleStore.getState();
    const pattern = dm.patterns.find((p) => p.id === dm.currentPatternId);
    if (!pattern) return;
    const row = rowIndex !== undefined ? pattern.rows[rowIndex] : pattern.rows.find((r) => !r.sampleId);
    if (row) useSampleStore.getState().setRowSample(pattern.id, row.id, sample.id);
    sampleStore.incrementUsage(sample.id);
  };

  const insertAtPlayhead = useCallback(() => {
    setContextMenu(null);
    const dawState = useDAWStore.getState();
    const bpm = dawState.project.bpm;
    const durationBeats = sample.duration * (bpm / 60);
    const startBeat = dawState.positionBeats;

    // Find selected/first audio track or create new one
    const audioTrack = dawState.project.tracks.find(
      (t) => t.type === 'audio' && dawState.selectedTrackIds.includes(t.id),
    ) ?? dawState.project.tracks.find((t) => t.type === 'audio');

    let trackId: string;
    if (audioTrack) {
      trackId = audioTrack.id;
    } else {
      dawState.pushHistory('Add audio track');
      trackId = dawState.addTrack('audio');
    }

    dawState.pushHistory('Insert sample clip');
    dawState.addAudioClip(trackId, startBeat, durationBeats, sample.name, sample.id, sample.waveformData);
    void preloadDawBuffer(sample.id);
    sampleStore.incrementUsage(sample.id);
  }, [sample, sampleStore]);

  const insertInNewTrack = useCallback(() => {
    setContextMenu(null);
    const dawState = useDAWStore.getState();
    const bpm = dawState.project.bpm;
    const durationBeats = sample.duration * (bpm / 60);
    const startBeat = dawState.positionBeats;

    dawState.pushHistory('Insert sample in new track');
    const trackId = dawState.addTrack('audio');
    dawState.addAudioClip(trackId, startBeat, durationBeats, sample.name, sample.id, sample.waveformData);
    void preloadDawBuffer(sample.id);
    sampleStore.incrementUsage(sample.id);
  }, [sample, sampleStore]);

  const openInSampleEditor = useCallback(() => {
    setContextMenu(null);
    // Find or create a clip with this sample, then open editor
    const dawState = useDAWStore.getState();
    let clipId: string | undefined;
    for (const track of dawState.project.tracks) {
      const clip = track.clips.find((c) => c.audioFileId === sample.id);
      if (clip) { clipId = clip.id; break; }
    }
    if (clipId) {
      dawState.setSampleEditorOpen(true, clipId);
    }
  }, [sample]);

  const handleArmClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const dawState = useDAWStore.getState();
    if (isArmed) {
      dawState.disarmSample();
    } else {
      dawState.armSample({
        id: sample.id,
        name: sample.name,
        duration: sample.duration,
        color: catColor,
        category: sample.category,
        waveformData: sample.waveformData,
      });
    }
    void sampleManager.getOrDecodeBuffer(sample.id).then((buf) => {
      if (buf) storeAudioBuffer(sample.id, buf);
    });
  }, [isArmed, sample, catColor]);

  // Make draggable for dnd to pads / DAW arrangement
  const handleDragStart = (e: React.DragEvent) => {
    // Include both protocols so both DrumPads and DAW timeline can pick it up
    e.dataTransfer.setData('application/x-sample-id', sample.id);
    e.dataTransfer.setData('application/x-sample', JSON.stringify({
      id: sample.id,
      name: sample.name,
      duration: sample.duration,
      bpm: sample.bpm ?? null,
      category: sample.category,
      waveformLength: sample.waveformData.length,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // ─── Get drum machine rows for submenu ──────────────────────────────────────
  const drumRows = (() => {
    const { dm } = useSampleStore.getState();
    const pattern = dm.patterns.find((p) => p.id === dm.currentPatternId);
    return pattern?.rows.slice(0, 8) ?? [];
  })();

  return (
    <>
      <div
        className="flex items-center gap-1 px-2 h-9 cursor-pointer select-none relative"
        style={{
          background: isArmed
            ? `${catColor}14`
            : isSelected ? 'rgba(0,245,255,0.07)' : isPreview ? 'rgba(0,245,255,0.04)' : 'transparent',
          borderLeft: isArmed ? `3px solid ${catColor}` : isPreview ? '2px solid #00f5ff' : isSelected ? '2px solid transparent' : '2px solid transparent',
          ...style,
        }}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
      >
        {/* Type icon + category color dot */}
        <div className="flex items-center gap-1 w-7 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: catColor }} />
          <span style={{ color: catColor, opacity: 0.8 }}>{TYPE_ICON[sample.type]}</span>
        </div>

        {/* ARM button — shown FIRST in DAW mode so it's never clipped */}
        {dawMode && (
          <button
            title={isArmed ? 'Desactivar inserción por click' : 'Activar inserción por click en el timeline'}
            onClick={handleArmClick}
            className="flex items-center justify-center w-5 h-5 rounded shrink-0 transition-all"
            style={{
              background: isArmed ? catColor : 'var(--bg-card)',
              border: `1px solid ${isArmed ? catColor : 'var(--border)'}`,
              color: isArmed ? '#000' : catColor,
            }}
          >
            <Pin size={9} fill={isArmed ? '#000' : 'none'} />
          </button>
        )}

        {/* Waveform */}
        <div className="shrink-0">
          <WaveformThumb
            waveformData={sample.waveformData}
            progress={isPreview ? previewProgress : 0}
            color={catColor}
            width={dawMode ? 48 : 64}
            height={22}
          />
        </div>

        {/* Name */}
        <span className="flex-1 text-[11px] truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-rajdhani)' }}>
          {sample.name}
        </span>

        {/* Duration */}
        <span className="text-[9px] w-8 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
          {sample.duration < 1 ? `${(sample.duration * 1000).toFixed(0)}ms` : `${sample.duration.toFixed(1)}s`}
        </span>

        {/* BPM — hidden in DAW mode to save space */}
        {!dawMode && (
          <span className="text-[9px] w-8 text-right shrink-0" style={{ color: sample.bpm ? '#ffbe0b' : 'var(--text-muted)' }}>
            {sample.bpm ? sample.bpm : '—'}
          </span>
        )}

        {/* Key — hidden in DAW mode */}
        {!dawMode && (
          <span className="text-[9px] w-6 text-right shrink-0" style={{ color: sample.key ? '#00f5ff' : 'var(--text-muted)' }}>
            {sample.key ?? '—'}
          </span>
        )}

        {/* Stars — hidden in DAW mode */}
        {!dawMode && (
          <div className="flex gap-0.5 shrink-0">
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                onClick={(e) => { e.stopPropagation(); useSampleStore.getState().setRating(sample.id, r === sample.rating ? 0 : r); }}
                className="w-2 h-2"
              >
                <Star size={8} fill={r <= sample.rating ? '#ffbe0b' : 'none'} color={r <= sample.rating ? '#ffbe0b' : '#333344'} />
              </button>
            ))}
          </div>
        )}

        {/* Favorite */}
        <FavoritesStar sampleId={sample.id} isFavorite={sample.isFavorite} />

        {/* Shortcut slot selector (DAW mode only) */}
        {dawMode && (
          <select
            value={shortcutKey ?? ''}
            title="Tecla rápida (1–9)"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              const k = parseInt(e.target.value);
              if (!isNaN(k)) useDAWStore.getState().setSampleShortcut(k, sample.id);
            }}
            className="text-[9px] h-5 rounded px-0.5 outline-none cursor-pointer"
            style={{
              background: shortcutKey ? `${catColor}22` : 'var(--bg-card)',
              color: shortcutKey ? catColor : 'var(--text-muted)',
              border: `1px solid ${shortcutKey ? catColor + '66' : 'var(--border)'}`,
              width: 26,
              flexShrink: 0,
            }}
          >
            <option value="">—</option>
            {[1,2,3,4,5,6,7,8,9].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 rounded-lg border py-1 text-xs overflow-y-auto"
            style={{ left: contextMenu.x, top: contextMenu.y, background: 'var(--bg-card)', borderColor: 'var(--border)', minWidth: 200, maxHeight: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', fontFamily: 'var(--font-rajdhani)' }}
          >
            {/* DAW-specific actions */}
            {dawMode && (<>
              <div className="px-3 pt-1 pb-0.5 text-[9px] uppercase tracking-widest" style={{ color: 'var(--accent-cyan)' }}>DAW</div>
              <MenuItem label="Insert at Playhead" action={insertAtPlayhead} />
              <MenuItem label="Insert in New Track" action={insertInNewTrack} />
              <MenuItem label="Open in Sample Editor" action={openInSampleEditor} />
              <Divider />
              {/* Drum Machine rows submenu */}
              <div className="px-3 py-0.5 text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Drum Machine</div>
              {drumRows.map((row, i) => (
                <MenuItem key={row.id} label={`→ Row ${i + 1}: ${row.name}`} action={() => addToDrumMachine(i)} />
              ))}
              <Divider />
            </>)}

            {/* DJ actions */}
            {!dawMode && (<>
              <MenuItem label="Send to Deck A" action={() => sendToDeck('A')} />
              <MenuItem label="Send to Deck B" action={() => sendToDeck('B')} />
              <Divider />
            </>)}

            <MenuItem label="Add to Drum Machine (auto)" action={() => addToDrumMachine()} />
            <Divider />
            <MenuItem label={sample.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'} action={() => { setContextMenu(null); useSampleStore.getState().toggleFavorite(sample.id); }} />
          </div>
        </>
      )}
    </>
  );
}

function MenuItem({ label, action }: { label: string; action: () => void }) {
  return (
    <button className="w-full text-left px-3 py-1 hover:bg-white/5 transition-colors" style={{ color: 'var(--text-primary)' }} onClick={action}>
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />;
}
