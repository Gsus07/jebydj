'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Circle, Download, Ghost, Target, Smartphone, Layers, Music2, Grid3X3 } from 'lucide-react';
import { useSampleStore } from '@/src/store/useSampleStore';
import { useAudioEngine } from '@/src/hooks/useAudioEngine';
import { useKeyboard } from '@/src/hooks/useKeyboard';
import { useDJStore } from '@/src/store/useDJStore';
import { useProceduralSounds } from '@/src/hooks/useProceduralSounds';
import { MobileDJLayout } from '@/src/components/layout/MobileDJLayout';

const DAWLayout = dynamic(() => import('@/src/components/daw/DAWLayout'), { ssr: false });
const SampleBrowser = dynamic(() => import('@/src/components/library/SampleBrowser').then((m) => ({ default: m.SampleBrowser })), { ssr: false });
const DrumMachine = dynamic(() => import('@/src/components/drumpad/DrumMachine').then((m) => ({ default: m.DrumMachine })), { ssr: false });
import { Deck } from '@/src/components/deck/Deck';
import { Mixer } from '@/src/components/mixer/Mixer';
import { EffectsRack } from '@/src/components/effects/EffectsRack';
import { SpectrumAnalyzer } from '@/src/components/visualizer/SpectrumAnalyzer';
import { Oscilloscope } from '@/src/components/visualizer/Oscilloscope';
import { StereoCorrelation } from '@/src/components/visualizer/StereoCorrelation';
import { Sampler } from '@/src/components/sampler/Sampler';
import { TrackLibrary } from '@/src/components/library/TrackLibrary';
import { DisplayNumber } from '@/src/components/ui/DisplayNumber';
import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { GhostOverlay } from '@/src/components/session/GhostOverlay';
import { SetPlanner } from '@/src/components/planner/SetPlanner';
import { PracticeMode } from '@/src/components/practice/PracticeMode';
import { CamelotWheel } from '@/src/components/library/CamelotWheel';
import { MobileControllerModal } from '@/src/components/controller/MobileControllerModal';

export default function DJApp() {
  useAudioEngine();
  useKeyboard();
  useProceduralSounds();

  const isAudioReady = useDJStore((s) => s.isAudioReady);
  const activeDeck = useDJStore((s) => s.activeDeck);
  const showSettings = useDJStore((s) => s.settings.showSettings);
  const practiceActive = useDJStore((s) => s.practiceMode.active);
  const { setShowSettings, setActiveDeck, setPracticeActive } = useDJStore.getState();

  const [mode, setMode] = useState<'dj' | 'daw'>('dj');
  const [libTab, setLibTab] = useState<'tracks' | 'samples'>('tracks');
  const drumMachineOpen = useSampleStore((s) => s.drumMachineOpen);
  const setDrumMachineOpen = (v: boolean) => useSampleStore.getState().setDrumMachineOpen(v);
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [showMobileCtrl, setShowMobileCtrl] = useState(false);

  // Responsive: detect narrow viewport
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!audioEngine.isInitialized()) return;
    try {
      const dest = audioEngine.ctx.createMediaStreamDestination();
      audioEngine.masterAnalyser.connect(dest);
      const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dj-mix-${new Date().toISOString().slice(0, 19)}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setRecTime(0);
      };

      recorder.start(100);
      setMediaRecorder(recorder);
      setIsRecording(true);

      const start = Date.now();
      const timer = setInterval(() => {
        setRecTime(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      (recorder as MediaRecorder & { _timer?: ReturnType<typeof setInterval> })._timer = timer;
    } catch (err) {
      console.error('Recording failed:', err);
    }
  }, []);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorder) {
      const mr = mediaRecorder as MediaRecorder & { _timer?: ReturnType<typeof setInterval> };
      if (mr._timer) clearInterval(mr._timer);
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  }, [mediaRecorder]);

  const formatRecTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div
      className="flex flex-col h-screen overflow-hidden select-none"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* ── HEADER ── */}
      <header
        className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0"
        style={{ borderColor: '#2a2a3a', backgroundColor: '#0d0d14', minHeight: isMobile ? 44 : 48 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="font-orbitron font-black" style={{ fontSize: isMobile ? 14 : 20, color: '#00f5ff', textShadow: '0 0 16px rgba(0,245,255,0.6)' }}>JEBY</span>
          <span className="font-orbitron font-black" style={{ fontSize: isMobile ? 14 : 20, color: '#ff006e', textShadow: '0 0 16px rgba(255,0,110,0.6)' }}>DJ</span>
        </div>

        {/* Active deck — hide on mobile (controlled inside MobileDJLayout) */}
        {!isMobile && (
          <div className="flex gap-1 flex-shrink-0">
            {(['A', 'B'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setActiveDeck(d)}
                className="text-[9px] font-orbitron font-bold w-6 h-6 rounded border transition-all"
                style={{
                  borderColor: activeDeck === d ? (d === 'A' ? '#00f5ff' : '#ff006e') : '#2a2a3a',
                  color: activeDeck === d ? (d === 'A' ? '#00f5ff' : '#ff006e') : '#555566',
                  backgroundColor: activeDeck === d ? (d === 'A' ? '#00f5ff22' : '#ff006e22') : 'transparent',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {/* DJ / DAW mode toggle */}
        <div className="flex gap-1 flex-shrink-0 ml-1">
          <button
            onClick={() => setMode('dj')}
            className="flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-orbitron transition-all"
            style={{
              borderColor: mode === 'dj' ? '#00f5ff' : '#2a2a3a',
              color: mode === 'dj' ? '#00f5ff' : '#555566',
              backgroundColor: mode === 'dj' ? '#00f5ff11' : 'transparent',
            }}
          >
            <Music2 size={10} />{!isMobile && 'DJ'}
          </button>
          <button
            onClick={() => setMode('daw')}
            className="flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-orbitron transition-all"
            style={{
              borderColor: mode === 'daw' ? '#ff006e' : '#2a2a3a',
              color: mode === 'daw' ? '#ff006e' : '#555566',
              backgroundColor: mode === 'daw' ? '#ff006e11' : 'transparent',
            }}
          >
            <Layers size={10} />{!isMobile && 'DAW'}
          </button>
        </div>

        {/* Spectrum — smaller on mobile */}
        <div className="flex-1 min-w-0 mx-1">
          <SpectrumAnalyzer height={isMobile ? 24 : 32} mode="dual" />
        </div>

        {/* Recording */}
        {!isMobile && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {isRecording ? (
              <>
                <DisplayNumber value={formatRecTime(recTime)} color="#ff0000" size="sm" label="REC" />
                <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 rounded-full bg-red-500" />
                <button onClick={handleStopRecording} className="flex items-center gap-1 px-2 py-1 rounded border border-red-500 text-red-400 text-[10px] font-rajdhani hover:bg-red-950">
                  <Download size={11} />STOP
                </button>
              </>
            ) : (
              <button
                onClick={handleStartRecording}
                disabled={!isAudioReady}
                className="flex items-center gap-1 px-2 py-1 rounded border border-[#2a2a3a] text-muted text-[10px] font-rajdhani hover:border-red-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Circle size={11} />REC
              </button>
            )}
          </div>
        )}

        <button onClick={() => setShowSettings(!showSettings)} className="text-muted hover:text-white flex-shrink-0">
          <Settings size={15} />
        </button>

        {/* Ghost Session — hide on mobile */}
        {!isMobile && (
          <div className="flex-shrink-0">
            <GhostOverlay />
          </div>
        )}

        {/* Practice Mode toggle — hide on mobile */}
        {!isMobile && (
          <button
            onClick={() => setPracticeActive(!practiceActive)}
            className="flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-orbitron flex-shrink-0 transition-all"
            style={{
              borderColor: practiceActive ? '#ffbe0b' : '#2a2a3a',
              color: practiceActive ? '#ffbe0b' : '#555566',
              backgroundColor: practiceActive ? '#ffbe0b11' : 'transparent',
            }}
          >
            <Target size={11} />PRACTICE
          </button>
        )}

        {/* Mobile Controller */}
        <button
          onClick={() => setShowMobileCtrl(true)}
          className="flex items-center gap-1 px-2 py-1 rounded border border-[#2a2a3a] text-muted text-[9px] font-orbitron hover:border-[#00f5ff] hover:text-[#00f5ff] flex-shrink-0"
        >
          <Smartphone size={11} />{!isMobile && 'CTRL'}
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isAudioReady ? '#00cc44' : '#ff4400', boxShadow: isAudioReady ? '0 0 5px #00cc44' : 'none' }} />
          {!isMobile && <span className="text-[8px] font-rajdhani text-muted">{isAudioReady ? 'AUDIO OK' : 'CLICK TO INIT'}</span>}
        </div>
      </header>

      {/* ── MAIN ── */}
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'daw' ? (
          <motion.div
            key="daw"
            className="flex-1 min-h-0 overflow-hidden"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.2 }}
          >
            <DAWLayout />
          </motion.div>
        ) : (
          <motion.div
            key="dj"
            className="flex flex-1 min-h-0 overflow-hidden"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── Mobile layout (< 768px) ── */}
            {isMobile ? (
              <MobileDJLayout />
            ) : (
              <>
      {/* Library + Camelot */}
        <div className="flex flex-col flex-shrink-0 h-full border-r overflow-hidden" style={{ borderColor: '#2a2a3a', width: 280 }}>
          {/* Library tab bar */}
          <div className="flex border-b shrink-0" style={{ borderColor: '#2a2a3a' }}>
            {(['tracks', 'samples'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLibTab(tab)}
                className="flex-1 py-1 text-[9px] font-orbitron uppercase tracking-wider transition-all"
                style={{
                  borderBottom: libTab === tab ? '2px solid #00f5ff' : '2px solid transparent',
                  color: libTab === tab ? '#00f5ff' : '#555566',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          {libTab === 'tracks' ? (
            <>
              <div className="flex-1 min-h-0 overflow-hidden">
                <TrackLibrary />
              </div>
              <div className="border-t flex-shrink-0 p-2" style={{ borderColor: '#2a2a3a' }}>
                <CamelotWheel />
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden">
              <SampleBrowser />
            </div>
          )}
        </div>

        {/* DJ Booth */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Decks + Mixer */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-w-0 p-2 overflow-y-auto" style={{ maxWidth: '42%' }}>
              <Deck deckId="A" />
            </div>
            <div className="flex-shrink-0 p-2 overflow-y-auto" style={{ width: 210 }}>
              <Mixer />
            </div>
            <div className="flex-1 min-w-0 p-2 overflow-y-auto" style={{ maxWidth: '42%' }}>
              <Deck deckId="B" />
            </div>
          </div>

          {/* Practice Mode (collapsible bottom panel) */}
          <AnimatePresence>
            {practiceActive && <PracticeMode />}
          </AnimatePresence>

          {/* Drum Machine (collapsible) */}
          <AnimatePresence>
            {drumMachineOpen && (
              <motion.div
                key="drum"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden', flexShrink: 0 }}
              >
                <DrumMachine />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom: Effects + Sampler + Visualizers */}
          <div className="flex gap-2 px-2 pb-2 flex-shrink-0 overflow-x-auto" style={{ borderTop: '1px solid #2a2a3a', paddingTop: 8 }}>
            <div className="flex-1 min-w-0"><EffectsRack /></div>
            <div className="flex-shrink-0"><Sampler /></div>
            <div className="flex gap-2 flex-shrink-0 items-start">
              <Oscilloscope deckId="A" width={140} height={75} />
              <Oscilloscope deckId="B" width={140} height={75} />
              <StereoCorrelation size={75} />
            </div>
          </div>
        </div>

        {/* Set Planner right sidebar */}
        <SetPlanner />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Controller Modal */}
      <AnimatePresence>
        {showMobileCtrl && (
          <MobileControllerModal onClose={() => setShowMobileCtrl(false)} />
        )}
      </AnimatePresence>

      {/* Settings modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="p-6 rounded-xl max-w-md w-full mx-4"
              style={{ backgroundColor: '#111118', border: '1px solid #2a2a3a' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-sm font-rajdhani font-bold uppercase tracking-widest text-white mb-4">Settings</h2>
              <div className="space-y-3 text-xs font-rajdhani text-muted">
                <p>Audio status: <span className="text-white">{isAudioReady ? 'Ready' : 'Not initialized (click anywhere first)'}</span></p>
                <div className="border border-[#2a2a3a] rounded p-3 text-[10px] space-y-1">
                  <p className="text-white font-semibold mb-2">Keyboard Shortcuts</p>
                  <p>SPACE — Play/Pause active deck</p>
                  <p>TAB — Switch active deck (A ↔ B)</p>
                  <p>A / Z — Nudge Deck A forward / back</p>
                  <p>S / X — Nudge Deck B forward / back</p>
                  <p>1–8 — Jump to hot cue</p>
                  <p>SHIFT+1–8 — Set hot cue at current position</p>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full py-2 rounded border border-[#2a2a3a] hover:border-[#00f5ff] hover:text-[#00f5ff] transition-colors font-rajdhani"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
