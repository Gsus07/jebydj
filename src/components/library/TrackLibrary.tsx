'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDJStore } from '@/src/store/useDJStore';
import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { getDeckPlayer } from '@/src/lib/audio/DeckPlayer';
import { generateWaveform } from '@/src/lib/audio/WaveformAnalyzer';
import { detectBPM, detectKey } from '@/src/lib/audio/BPMDetector';
import { formatTimeShort } from '@/src/lib/utils/formatTime';
import { harmonicCompatibility } from '@/src/lib/utils/bpmUtils';
import type { Track } from '@/src/store/types';
import { Search, Upload, ChevronUp, ChevronDown, Music, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { set as idbSet, get as idbGet, del as idbDel, keys as idbKeys } from 'idb-keyval';

// ─── Audio buffer cache ───────────────────────────────────────────────────────
const audioBufferCache: Map<string, ArrayBuffer> = new Map();

function generateTrackId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

async function analyzeTrack(arrayBuffer: ArrayBuffer): Promise<{
  bpm: number;
  key: string;
  waveformData: Float32Array;
  waveformColors: Uint8Array;
}> {
  const tempCtx = new OfflineAudioContext(1, 1, 44100);
  const audioBuffer = await audioEngine.decodeAudioData(arrayBuffer.slice(0));
  const { waveformData, waveformColors } = generateWaveform(audioBuffer);
  const bpm = detectBPM(audioBuffer);
  const key = detectKey(audioBuffer);
  return { bpm, key, waveformData, waveformColors };
}

function TrackRow({
  track,
  isSelected,
  compatKey,
  onSelect,
  onLoadToDeck,
  onRemove,
  onDragStart,
}: {
  track: Track;
  isSelected: boolean;
  compatKey: string;
  onSelect: () => void;
  onLoadToDeck: (deck: 'A' | 'B') => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const compatColors: Record<string, string> = {
    perfect: '#00f5ff',
    adjacent: '#06d6a0',
    relative: '#8338ec',
    none: '',
  };
  const compat = compatKey || 'none';

  return (
    <div
      className="group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#1a1a24] transition-colors"
      style={{
        backgroundColor: isSelected ? '#1a1a2e' : 'transparent',
        borderLeft: compat !== 'none' ? `2px solid ${compatColors[compat]}` : '2px solid transparent',
      }}
      onClick={onSelect}
      onDoubleClick={() => onLoadToDeck('A')}
      draggable
      onDragStart={onDragStart}
    >
      <Music size={10} className="text-muted flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-rajdhani font-semibold text-primary truncate">{track.title || track.fileName}</div>
        <div className="text-[9px] font-rajdhani text-muted truncate">{track.artist}</div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[9px] font-orbitron text-muted w-8 text-right">
          {track.bpm > 0 ? track.bpm.toFixed(0) : '--'}
        </span>
        <span
          className="text-[9px] font-rajdhani w-8 text-center"
          style={{ color: track.key ? '#8338ec' : '#333344' }}
        >
          {track.key || '---'}
        </span>
        <span className="text-[9px] font-orbitron text-muted w-10 text-right">
          {track.duration > 0 ? formatTimeShort(track.duration) : '--:--'}
        </span>

        {/* Load buttons (visible on hover) */}
        <div className="hidden group-hover:flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onLoadToDeck('A'); }}
            className="text-[8px] font-orbitron px-1 py-0.5 rounded border border-[#00f5ff44] text-[#00f5ff] hover:bg-[#00f5ff22]"
          >A</button>
          <button
            onClick={(e) => { e.stopPropagation(); onLoadToDeck('B'); }}
            className="text-[8px] font-orbitron px-1 py-0.5 rounded border border-[#ff006e44] text-[#ff006e] hover:bg-[#ff006e22]"
          >B</button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-[8px] font-orbitron px-1 py-0.5 rounded border border-[#2a2a3a] text-muted hover:text-red-400"
          >✕</button>
        </div>
      </div>
    </div>
  );
}

export function TrackLibrary() {
  const library = useDJStore((s) => s.library);
  const { addTrack, removeTrack, setLibrarySearch, setSelectedTrack, setLibraryVisible, setLibrarySort } = useDJStore.getState();
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTrack = library.tracks.find((t) => t.id === library.selectedTrackId);

  // Filter + sort tracks
  const filteredTracks = useMemo(() => {
    let tracks = [...library.tracks];

    if (library.searchQuery) {
      const q = library.searchQuery.toLowerCase();
      tracks = tracks.filter(
        (t) => (t.title || t.fileName).toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      );
    }

    if (library.filterKey) {
      tracks = tracks.filter((t) => t.key === library.filterKey);
    }

    tracks = tracks.filter((t) => t.bpm === 0 || (t.bpm >= library.bpmMin && t.bpm <= library.bpmMax));

    tracks.sort((a, b) => {
      const key = library.sortBy as keyof Track;
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return library.sortDir === 'asc' ? cmp : -cmp;
    });

    return tracks;
  }, [library.tracks, library.searchQuery, library.filterKey, library.bpmMin, library.bpmMax, library.sortBy, library.sortDir]);

  const loadFile = useCallback(async (file: File) => {
    if (!audioEngine.isInitialized()) return;
    setIsLoading(true);
    try {
      const id = generateTrackId(file);
      const existing = library.tracks.find((t) => t.id === id);
      if (existing) { setIsLoading(false); return; }

      const arrayBuffer = await file.arrayBuffer();
      audioBufferCache.set(id, arrayBuffer);

      // Try to get from IndexedDB
      let bpm = 0;
      let key = '';
      let waveformData: Float32Array | null = null;
      let waveformColors: Uint8Array | null = null;

      try {
        const cached = await idbGet<{ bpm: number; key: string; waveformData: number[]; waveformColors: number[] }>(id);
        if (cached) {
          bpm = cached.bpm;
          key = cached.key;
          waveformData = new Float32Array(cached.waveformData);
          waveformColors = new Uint8Array(cached.waveformColors);
        }
      } catch { /* ignore */ }

      if (!waveformData) {
        const result = await analyzeTrack(arrayBuffer);
        bpm = result.bpm;
        key = result.key;
        waveformData = result.waveformData;
        waveformColors = result.waveformColors;

        // Save to IndexedDB
        try {
          await idbSet(id, {
            bpm,
            key,
            waveformData: Array.from(waveformData),
            waveformColors: Array.from(waveformColors),
          });
        } catch { /* ignore */ }
      }

      const nameParts = file.name.replace(/\.[^.]+$/, '').split(' - ');
      const artist = nameParts.length > 1 ? nameParts[0] : '';
      const title = nameParts.length > 1 ? nameParts.slice(1).join(' - ') : nameParts[0];

      const track: Track = {
        id,
        fileName: file.name,
        title,
        artist,
        bpm,
        key,
        duration: 0, // Will be set when decoded
        waveformData,
        waveformColors,
        fileSize: file.size,
        dateAdded: Date.now(),
      };

      // Get duration
      try {
        const audioBuffer = await audioEngine.decodeAudioData(arrayBuffer.slice(0));
        track.duration = audioBuffer.duration;
      } catch { /* ignore */ }

      addTrack(track);
    } catch (err) {
      console.error('Failed to load file:', err);
    } finally {
      setIsLoading(false);
    }
  }, [library.tracks, addTrack]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileList = Array.from(files);
    fileList.forEach((f) => {
      if (f.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aiff?)$/i.test(f.name)) {
        loadFile(f);
      }
    });
  }, [loadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleLoadToDeck = useCallback(async (track: Track, deckId: 'A' | 'B') => {
    const arrayBuffer = audioBufferCache.get(track.id);
    if (!arrayBuffer) return;
    const player = getDeckPlayer(deckId);
    if (!player.isPlaying) {
      const { useDeck: _hook } = await import('@/src/hooks/useDeck');
      // Load via the DJStore approach
      const store = useDJStore.getState();
      store.setDeckLoading(deckId, true);
      try {
        const audioBuf = await audioEngine.decodeAudioData(arrayBuffer.slice(0));
        player.loadBuffer(audioBuf);
        store.setDeckTrack(deckId, {
          trackName: track.title || track.fileName,
          artistName: track.artist,
          duration: audioBuf.duration,
          bpm: track.bpm,
          detectedBpm: track.bpm,
          key: track.key,
          waveformData: track.waveformData,
          waveformColors: track.waveformColors,
          currentTime: 0,
          cuePoint: 0,
          hotCues: [],
          isPlaying: false,
        });
      } finally {
        store.setDeckLoading(deckId, false);
      }
    }
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, track: Track) => {
    const arrayBuffer = audioBufferCache.get(track.id);
    e.dataTransfer.setData('application/x-dj-track', JSON.stringify({
      ...track,
      arrayBuffer: arrayBuffer ? Array.from(new Uint8Array(arrayBuffer)) : null,
    }));
  }, []);

  if (!library.isVisible) {
    return (
      <button
        onClick={() => setLibraryVisible(true)}
        className="flex items-center gap-2 px-3 py-2 rounded border border-[#2a2a3a] text-muted hover:text-white text-xs font-rajdhani"
      >
        <ChevronRight size={14} />
        LIBRARY
      </button>
    );
  }

  return (
    <div
      className="flex flex-col w-full h-full overflow-hidden"
      style={{ minHeight: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a3a]">
        <span className="text-[10px] font-rajdhani uppercase tracking-widest text-muted">
          LIBRARY ({filteredTracks.length})
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-muted hover:text-white"
            title="Import tracks"
          >
            <Upload size={13} />
          </button>
          <button
            onClick={() => setLibraryVisible(false)}
            className="text-muted hover:text-white"
          >
            <ChevronLeft size={13} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-[#2a2a3a]">
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#0a0a0f] border border-[#2a2a3a]">
          <Search size={11} className="text-muted flex-shrink-0" />
          <input
            type="text"
            placeholder="Search tracks..."
            value={library.searchQuery}
            onChange={(e) => setLibrarySearch(e.target.value)}
            className="flex-1 bg-transparent text-[11px] font-rajdhani text-primary outline-none placeholder:text-muted"
          />
          {library.searchQuery && (
            <button onClick={() => setLibrarySearch('')} className="text-muted hover:text-white">
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-[#2a2a3a] text-[8px] font-rajdhani text-muted uppercase">
        <div className="flex-1">TITLE / ARTIST</div>
        <SortHeader label="BPM" field="bpm" sortBy={library.sortBy as string} sortDir={library.sortDir} onSort={setLibrarySort} />
        <SortHeader label="KEY" field="key" sortBy={library.sortBy as string} sortDir={library.sortDir} onSort={setLibrarySort} />
        <SortHeader label="DUR" field="duration" sortBy={library.sortBy as string} sortDir={library.sortDir} onSort={setLibrarySort} />
      </div>

      {/* Drop zone + Track list */}
      <div
        className="flex-1 overflow-y-auto min-h-0"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        style={{ backgroundColor: isDragOver ? '#00f5ff11' : 'transparent' }}
      >
        {filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted py-8">
            <Upload size={24} />
            <span className="text-xs font-rajdhani text-center px-4">
              {library.tracks.length === 0
                ? 'Drop audio files here or click Import'
                : 'No tracks match your search'}
            </span>
          </div>
        ) : (
          <AnimatePresence>
            {filteredTracks.map((track) => {
              const compat = selectedTrack && selectedTrack.id !== track.id
                ? harmonicCompatibility(selectedTrack.key, track.key)
                : '';
              return (
                <TrackRow
                  key={track.id}
                  track={track}
                  isSelected={library.selectedTrackId === track.id}
                  compatKey={compat}
                  onSelect={() => setSelectedTrack(track.id)}
                  onLoadToDeck={(deck) => handleLoadToDeck(track, deck)}
                  onRemove={() => removeTrack(track.id)}
                  onDragStart={(e) => handleDragStart(e, track)}
                />
              );
            })}
          </AnimatePresence>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-2 text-[10px] font-rajdhani text-muted">
            <div className="animate-spin w-3 h-3 border border-[#00f5ff] border-t-transparent rounded-full mr-2" />
            Analyzing...
          </div>
        )}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  field: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: keyof Track, dir: 'asc' | 'desc') => void;
}) {
  const isActive = sortBy === field;
  return (
    <button
      onClick={() => onSort(field as keyof Track, isActive && sortDir === 'asc' ? 'desc' : 'asc')}
      className="flex items-center gap-0.5 hover:text-white transition-colors"
      style={{ color: isActive ? '#00f5ff' : undefined }}
    >
      {label}
      {isActive && (sortDir === 'asc' ? <ChevronUp size={8} /> : <ChevronDown size={8} />)}
    </button>
  );
}
