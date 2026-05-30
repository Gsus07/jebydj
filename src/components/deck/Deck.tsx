'use client';

import { useCallback, useRef, useState } from 'react';
import { useDeck } from '@/src/hooks/useDeck';
import { useIsNarrow } from '@/src/hooks/useIsNarrow';
import { DeckWaveform } from './DeckWaveform';
import { DeckVinyl } from './DeckVinyl';
import { DeckControls } from './DeckControls';
import { DeckEQ } from './DeckEQ';
import { DeckPitch } from './DeckPitch';
import { DeckHotcues } from './DeckHotcues';
import { DeckLoop } from './DeckLoop';
import { DisplayNumber } from '@/src/components/ui/DisplayNumber';
import { formatTime, formatTimeShort } from '@/src/lib/utils/formatTime';
import type { DeckId } from '@/src/store/types';
import { Upload } from 'lucide-react';

interface DeckProps {
  deckId: DeckId;
  forceNarrow?: boolean;
}

export function Deck({ deckId, forceNarrow }: DeckProps) {
  const {
    deck, initPlayer, loadTrack, togglePlay, cue, seek, sync,
    toggleReverse, toggleKeylock, setEQHigh, setEQMid, setEQLow,
    setTempo, setVolume, activateHotCue, setHotCue, deleteHotCue,
    setLoopIn, setLoopOut, toggleLoop, setLoopSize, halveLoop, doubleLoop,
    scratch, releaseScratch, nudgeForward, nudgeBack, setTempoRange,
  } = useDeck(deckId);

  const narrow = useIsNarrow() || !!forceNarrow;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const accentColor = deckId === 'A' ? '#00f5ff' : '#ff006e';

  const handleFileLoad = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    const nameParts = file.name.replace(/\.[^.]+$/, '').split(' - ');
    const artist = nameParts.length > 1 ? nameParts[0] : '';
    const title = nameParts.length > 1 ? nameParts.slice(1).join(' - ') : nameParts[0];
    await loadTrack(buffer, file.name, title, artist);
  }, [loadTrack]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileLoad(file);
    e.target.value = '';
  }, [handleFileLoad]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const trackJson = e.dataTransfer.getData('application/x-dj-track');
    if (trackJson) {
      try {
        const td = JSON.parse(trackJson);
        if (td.arrayBuffer) {
          const arr = new Uint8Array(td.arrayBuffer).buffer;
          loadTrack(arr, td.fileName, td.title, td.artist, td.bpm, td.key);
        }
      } catch { /* ignore */ }
      return;
    }
    const file = e.dataTransfer.files[0];
    if (file) handleFileLoad(file);
  }, [handleFileLoad, loadTrack]);

  const remainingTime = deck.duration > 0 ? Math.max(0, deck.duration - deck.currentTime) : 0;
  const vinylSize = narrow ? 140 : 180;
  const eqKnobSize = narrow ? 34 : 44;

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-xl h-full relative"
      style={{
        backgroundColor: '#111118',
        border: `1px solid ${deck.isPlaying ? accentColor : '#2a2a3a'}`,
        boxShadow: deck.isPlaying ? `0 0 20px ${accentColor}22` : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
    >
      {isDragOver && (
        <div
          className="absolute inset-0 rounded-xl flex items-center justify-center z-10 pointer-events-none"
          style={{ backgroundColor: `${accentColor}22`, border: `2px dashed ${accentColor}` }}
        >
          <span className="text-sm font-rajdhani font-semibold" style={{ color: accentColor }}>Drop track here</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-orbitron font-bold text-lg"
            style={{ backgroundColor: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}` }}
          >
            {deckId}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-rajdhani font-semibold text-primary truncate max-w-[160px]">
              {deck.trackName || 'No track loaded'}
            </span>
            <span className="text-[10px] font-rajdhani text-muted truncate max-w-[160px]">{deck.artistName}</span>
          </div>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <DisplayNumber value={formatTime(deck.currentTime)} label="TIME" color={accentColor} size="sm" />
          <DisplayNumber
            value={`-${formatTimeShort(remainingTime)}`}
            label="REM"
            color={deck.isPlaying && remainingTime < 30 ? '#ff006e' : '#555566'}
            size="sm"
          />
        </div>
      </div>

      {/* Waveform */}
      <DeckWaveform
        deckId={deckId}
        waveformData={deck.waveformData}
        waveformColors={deck.waveformColors}
        currentTime={deck.currentTime}
        duration={deck.duration}
        hotCues={deck.hotCues}
        loopStart={deck.loop.inPoint}
        loopEnd={deck.loop.outPoint}
        loopActive={deck.loop.active}
        onSeek={seek}
      />

      {/* ── Mobile layout ───────────────────────────────────────────────────── */}
      {narrow ? (
        <>
          {/* Vinyl + right panel side by side */}
          <div className="flex gap-2 items-start">
            {/* Left: vinyl */}
            <div className="shrink-0">
              <DeckVinyl
                deckId={deckId}
                isPlaying={deck.isPlaying}
                tempo={deck.tempo}
                onScratch={scratch}
                onReleaseScratch={releaseScratch}
                trackName={deck.trackName}
                vinylSize={vinylSize}
              />
            </div>

            {/* Right: BPM/Key + controls + hotcues */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <div className="flex gap-2 justify-center">
                <DisplayNumber
                  value={deck.bpm > 0 ? (deck.bpm * deck.tempo).toFixed(1) : '---.--'}
                  label="BPM" color={accentColor} size="sm"
                />
                <DisplayNumber value={deck.key || '---'} label="KEY" color="#8338ec" size="sm" />
              </div>
              <DeckControls
                deckId={deckId}
                isPlaying={deck.isPlaying}
                isReverse={deck.isReverse}
                isKeylock={deck.isKeylock}
                isMaster={deck.isMaster}
                hasTrack={!!deck.trackName}
                onPlay={togglePlay}
                onCue={cue}
                onSync={sync}
                onReverse={toggleReverse}
                onKeylock={toggleKeylock}
              />
              <DeckHotcues
                deckId={deckId}
                hotCues={deck.hotCues}
                onActivateCue={activateHotCue}
                onSetCue={setHotCue}
                onDeleteCue={deleteHotCue}
              />
            </div>
          </div>

          {/* Pitch (compact horizontal) */}
          <DeckPitch
            deckId={deckId}
            tempo={deck.tempo}
            bpm={deck.bpm}
            detectedBpm={deck.detectedBpm}
            tempoRange={deck.tempoRange}
            onTempoChange={setTempo}
            onTempoRangeChange={setTempoRange}
            onNudgeForward={nudgeForward}
            onNudgeBack={nudgeBack}
            compact
          />

          {/* EQ + Loop */}
          <div className="flex gap-2">
            <DeckEQ
              deckId={deckId}
              eqHigh={deck.eqHigh}
              eqMid={deck.eqMid}
              eqLow={deck.eqLow}
              onChangeHigh={setEQHigh}
              onChangeMid={setEQMid}
              onChangeLow={setEQLow}
              knobSize={eqKnobSize}
            />
            <DeckLoop
              deckId={deckId}
              loop={deck.loop}
              onSetIn={setLoopIn}
              onSetOut={setLoopOut}
              onToggleActive={toggleLoop}
              onSetSize={setLoopSize}
              onHalve={halveLoop}
              onDouble={doubleLoop}
            />
          </div>
        </>
      ) : (
        /* ── Desktop layout ───────────────────────────────────────────────── */
        <>
          {/* Main area: vinyl + controls + pitch */}
          <div className="flex gap-3 items-start">
            <DeckVinyl
              deckId={deckId}
              isPlaying={deck.isPlaying}
              tempo={deck.tempo}
              onScratch={scratch}
              onReleaseScratch={releaseScratch}
              trackName={deck.trackName}
              vinylSize={vinylSize}
            />

            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex gap-3 justify-center">
                <DisplayNumber
                  value={deck.bpm > 0 ? (deck.bpm * deck.tempo).toFixed(1) : '---.--'}
                  label="BPM" color={accentColor} size="md"
                />
                <DisplayNumber value={deck.key || '---'} label="KEY" color="#8338ec" size="md" />
              </div>
              <DeckControls
                deckId={deckId}
                isPlaying={deck.isPlaying}
                isReverse={deck.isReverse}
                isKeylock={deck.isKeylock}
                isMaster={deck.isMaster}
                hasTrack={!!deck.trackName}
                onPlay={togglePlay}
                onCue={cue}
                onSync={sync}
                onReverse={toggleReverse}
                onKeylock={toggleKeylock}
              />
              <DeckHotcues
                deckId={deckId}
                hotCues={deck.hotCues}
                onActivateCue={activateHotCue}
                onSetCue={setHotCue}
                onDeleteCue={deleteHotCue}
              />
            </div>

            <DeckPitch
              deckId={deckId}
              tempo={deck.tempo}
              bpm={deck.bpm}
              detectedBpm={deck.detectedBpm}
              tempoRange={deck.tempoRange}
              onTempoChange={setTempo}
              onTempoRangeChange={setTempoRange}
              onNudgeForward={nudgeForward}
              onNudgeBack={nudgeBack}
            />
          </div>

          {/* EQ + Loop */}
          <div className="flex gap-2">
            <DeckEQ
              deckId={deckId}
              eqHigh={deck.eqHigh}
              eqMid={deck.eqMid}
              eqLow={deck.eqLow}
              onChangeHigh={setEQHigh}
              onChangeMid={setEQMid}
              onChangeLow={setEQLow}
              knobSize={eqKnobSize}
            />
            <DeckLoop
              deckId={deckId}
              loop={deck.loop}
              onSetIn={setLoopIn}
              onSetOut={setLoopOut}
              onToggleActive={toggleLoop}
              onSetSize={setLoopSize}
              onHalve={halveLoop}
              onDouble={doubleLoop}
            />
          </div>
        </>
      )}

      {/* Volume fader */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[9px] font-rajdhani text-muted uppercase">VOL</span>
        <input
          type="range" min="0" max="100"
          value={Math.round(deck.volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          className="flex-1 h-1 rounded cursor-pointer"
          style={{ accentColor }}
        />
        <span className="text-[9px] font-orbitron" style={{ color: accentColor }}>
          {Math.round(deck.volume * 100)}
        </span>
      </div>

      {/* Load button */}
      <button
        onClick={() => { initPlayer(); fileInputRef.current?.click(); }}
        className="flex items-center justify-center gap-2 py-1.5 rounded border border-dashed border-[#2a2a3a] hover:border-current text-muted hover:text-white transition-colors text-xs font-rajdhani"
      >
        <Upload size={12} />
        {deck.isLoading ? 'Loading...' : 'Load Track'}
      </button>
      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileInputChange} />
    </div>
  );
}
