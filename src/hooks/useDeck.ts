'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useDJStore } from '@/src/store/useDJStore';
import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { getDeckPlayer } from '@/src/lib/audio/DeckPlayer';
import { generateWaveform } from '@/src/lib/audio/WaveformAnalyzer';
import { detectBPM, detectKey } from '@/src/lib/audio/BPMDetector';
import type { DeckId, HotCue } from '@/src/store/types';

export function useDeck(deckId: DeckId) {
  const deck = useDJStore((s) => s.decks[deckId]);
  const otherDeck = useDJStore((s) => s.decks[deckId === 'A' ? 'B' : 'A']);
  const {
    setDeckPlaying,
    setDeckCurrentTime,
    setDeckDuration,
    setDeckTrack,
    setDeckTempo,
    setDeckLoading,
    setDeckEQ,
    setDeckHotCues,
    setDeckLoop,
    setDeckReverse,
    setDeckKeylock,
    setDeckCuePoint,
    setDeckMaster,
    setDeckTempoRange,
    setDeckPFL,
  } = useDJStore.getState();

  const player = getDeckPlayer(deckId);
  const timeUpdateRef = useRef<number>(0);

  // Initialize the deck player (runs once after audio engine is ready)
  const initPlayer = useCallback(() => {
    if (!audioEngine.isInitialized()) return;
    player.setup();
  }, [player]);

  // Load a track from an ArrayBuffer
  const loadTrack = useCallback(async (
    arrayBuffer: ArrayBuffer,
    fileName: string,
    title?: string,
    artist?: string,
    existingBpm?: number,
    existingKey?: string,
    existingWaveform?: Float32Array | null,
    existingWaveformColors?: Uint8Array | null,
  ) => {
    setDeckLoading(deckId, true);
    try {
      await audioEngine.resume();
      const audioBuffer = await audioEngine.decodeAudioData(arrayBuffer.slice(0));
      player.loadBuffer(audioBuffer);

      // Use existing data or analyze
      let bpm = existingBpm ?? 0;
      let key = existingKey ?? '';
      let waveformData = existingWaveform ?? null;
      let waveformColors = existingWaveformColors ?? null;

      if (!waveformData) {
        const result = generateWaveform(audioBuffer);
        waveformData = result.waveformData;
        waveformColors = result.waveformColors;
      }

      if (!bpm) {
        bpm = detectBPM(audioBuffer);
      }

      if (!key) {
        key = detectKey(audioBuffer);
      }

      // Load saved hot cues from localStorage
      const savedCues = loadCuesFromStorage(`${fileName}-${deckId}`);

      setDeckTrack(deckId, {
        trackName: title ?? fileName,
        artistName: artist ?? '',
        duration: audioBuffer.duration,
        bpm,
        detectedBpm: bpm,
        key,
        waveformData,
        waveformColors,
        currentTime: 0,
        cuePoint: 0,
        hotCues: savedCues,
        isPlaying: false,
        loop: { inPoint: null, outPoint: null, active: false, size: 1 },
      });
    } catch (err) {
      console.error('Failed to load track:', err);
    } finally {
      setDeckLoading(deckId, false);
    }
  }, [deckId, player, setDeckLoading, setDeckTrack]);

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    if (!player.hasBuffer) return;
    if (player.isPlaying) {
      player.pause();
      setDeckPlaying(deckId, false);
    } else {
      player.play();
      setDeckPlaying(deckId, true);
    }
  }, [player, deckId, setDeckPlaying]);

  // CUE
  const cue = useCallback(() => {
    const cuePoint = deck.cuePoint;
    player.seek(cuePoint);
    setDeckCurrentTime(deckId, cuePoint);
    if (player.isPlaying) {
      player.pause();
      setDeckPlaying(deckId, false);
    }
  }, [player, deck.cuePoint, deckId, setDeckCurrentTime, setDeckPlaying]);

  // Seek
  const seek = useCallback((time: number) => {
    player.seek(time);
    setDeckCurrentTime(deckId, time);
  }, [player, deckId, setDeckCurrentTime]);

  // Sync to other deck's BPM
  const sync = useCallback(() => {
    if (otherDeck.detectedBpm > 0 && deck.detectedBpm > 0) {
      const newTempo = otherDeck.bpm / deck.detectedBpm;
      setDeckTempo(deckId, newTempo);
      player.setPlaybackRate(newTempo);
    }
    setDeckMaster(deckId === 'A' ? 'B' : 'A');
  }, [otherDeck, deck, deckId, setDeckTempo, setDeckMaster, player]);

  // Reverse
  const toggleReverse = useCallback(() => {
    const newReverse = !deck.isReverse;
    setDeckReverse(deckId, newReverse);
    player.setReverse(newReverse);
  }, [deck.isReverse, deckId, setDeckReverse, player]);

  // Keylock
  const toggleKeylock = useCallback(() => {
    setDeckKeylock(deckId, !deck.isKeylock);
  }, [deck.isKeylock, deckId, setDeckKeylock]);

  // EQ
  const setEQHigh = useCallback((v: number) => {
    setDeckEQ(deckId, 'high', v);
    player.setEQHigh(v);
  }, [deckId, setDeckEQ, player]);

  const setEQMid = useCallback((v: number) => {
    setDeckEQ(deckId, 'mid', v);
    player.setEQMid(v);
  }, [deckId, setDeckEQ, player]);

  const setEQLow = useCallback((v: number) => {
    setDeckEQ(deckId, 'low', v);
    player.setEQLow(v);
  }, [deckId, setDeckEQ, player]);

  // Tempo
  const setTempo = useCallback((tempo: number) => {
    setDeckTempo(deckId, tempo);
    player.setPlaybackRate(tempo);
  }, [deckId, setDeckTempo, player]);

  // Volume
  const setVolume = useCallback((v: number) => {
    useDJStore.getState().setDeckVolume(deckId, v);
    player.setChannelVolume(v);
  }, [deckId, player]);

  // Hot Cues
  const activateHotCue = useCallback((id: number) => {
    const cue = deck.hotCues.find((c) => c.id === id);
    if (cue) {
      player.seek(cue.position);
      setDeckCurrentTime(deckId, cue.position);
    }
  }, [deck.hotCues, player, deckId, setDeckCurrentTime]);

  const setHotCue = useCallback((id: number) => {
    const position = player.getCurrentTime();
    const colors = [
      '#ff006e', '#00f5ff', '#ffbe0b', '#8338ec',
      '#fb5607', '#3a86ff', '#06d6a0', '#ef476f',
    ];
    const newCue: HotCue = { id, position, color: colors[id] ?? '#ffffff', label: `${id + 1}` };
    const newCues = deck.hotCues.filter((c) => c.id !== id).concat(newCue);
    setDeckHotCues(deckId, newCues);
    saveCuesToStorage(`${deck.trackName}-${deckId}`, newCues);
  }, [player, deck.hotCues, deck.trackName, deckId, setDeckHotCues]);

  const deleteHotCue = useCallback((id: number) => {
    const newCues = deck.hotCues.filter((c) => c.id !== id);
    setDeckHotCues(deckId, newCues);
    saveCuesToStorage(`${deck.trackName}-${deckId}`, newCues);
  }, [deck.hotCues, deck.trackName, deckId, setDeckHotCues]);

  // Loop
  const setLoopIn = useCallback(() => {
    const time = player.getCurrentTime();
    setDeckLoop(deckId, { inPoint: time });
  }, [player, deckId, setDeckLoop]);

  const setLoopOut = useCallback(() => {
    const time = player.getCurrentTime();
    setDeckLoop(deckId, { outPoint: time });
    // Auto-activate if in point is set
    if (deck.loop.inPoint !== null) {
      player.setLoop(deck.loop.inPoint, time, true);
      setDeckLoop(deckId, { active: true });
    }
  }, [player, deck.loop, deckId, setDeckLoop]);

  const toggleLoop = useCallback(() => {
    const newActive = !deck.loop.active;
    setDeckLoop(deckId, { active: newActive });
    player.setLoop(deck.loop.inPoint, deck.loop.outPoint, newActive);
  }, [deck.loop, deckId, setDeckLoop, player]);

  const setLoopSize = useCallback((size: number) => {
    const currentTime = player.getCurrentTime();
    const bpm = deck.bpm > 0 ? deck.bpm : 120;
    const beatDuration = 60 / bpm;
    const loopDuration = beatDuration * size;
    const loopEnd = currentTime + loopDuration;

    setDeckLoop(deckId, { inPoint: currentTime, outPoint: loopEnd, size, active: true });
    player.setLoop(currentTime, loopEnd, true);
  }, [player, deck.bpm, deckId, setDeckLoop]);

  const halveLoop = useCallback(() => setLoopSize(deck.loop.size / 2), [deck.loop.size, setLoopSize]);
  const doubleLoop = useCallback(() => setLoopSize(deck.loop.size * 2), [deck.loop.size, setLoopSize]);

  // Scratch
  const scratch = useCallback((rate: number) => player.scratch(rate), [player]);
  const releaseScratch = useCallback(() => player.releaseScratch(), [player]);

  // Nudge
  const nudgeForward = useCallback(() => player.nudge(true), [player]);
  const nudgeBack = useCallback(() => player.nudge(false), [player]);

  // Time update loop
  useEffect(() => {
    const update = () => {
      if (player.isPlaying) {
        const time = player.getCurrentTime();
        setDeckCurrentTime(deckId, time);
      }
      timeUpdateRef.current = requestAnimationFrame(update);
    };
    timeUpdateRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(timeUpdateRef.current);
  }, [player, deckId, setDeckCurrentTime]);

  return {
    deck,
    initPlayer,
    loadTrack,
    togglePlay,
    cue,
    seek,
    sync,
    toggleReverse,
    toggleKeylock,
    setEQHigh,
    setEQMid,
    setEQLow,
    setTempo,
    setVolume,
    activateHotCue,
    setHotCue,
    deleteHotCue,
    setLoopIn,
    setLoopOut,
    toggleLoop,
    setLoopSize,
    halveLoop,
    doubleLoop,
    scratch,
    releaseScratch,
    nudgeForward,
    nudgeBack,
    setTempoRange: (r: 8 | 16 | 100) => setDeckTempoRange(deckId, r),
    setCuePoint: () => setDeckCuePoint(deckId, player.getCurrentTime()),
  };
}

// ─── Hot cue persistence ─────────────────────────────────────────────────────

function loadCuesFromStorage(key: string): HotCue[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`hotcues:${key}`);
    if (raw) return JSON.parse(raw) as HotCue[];
  } catch {
    // ignore
  }
  return [];
}

function saveCuesToStorage(key: string, cues: HotCue[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`hotcues:${key}`, JSON.stringify(cues));
  } catch {
    // ignore
  }
}
