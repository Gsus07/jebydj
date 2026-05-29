'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ghost, Play, Pause, StopCircle, Upload, Gauge } from 'lucide-react';
import { useDJStore } from '@/src/store/useDJStore';
import { sessionRecorder } from '@/src/lib/session/SessionRecorder';
import { sessionPlayer } from '@/src/lib/session/SessionPlayer';
import type { SessionFile, SessionEvent } from '@/src/lib/session/types';

interface GhostControlProps {
  type: string;
  deck?: string;
  value: number;
  label?: string;
}

/** Animated ghost control indicator (shows what the ghost is doing) */
function GhostIndicator({ events }: { events: SessionEvent[] }) {
  const [lastEvent, setLastEvent] = useState<SessionEvent | null>(null);

  useEffect(() => {
    const off = sessionPlayer.addListener((e) => setLastEvent(e));
    return off;
  }, []);

  if (!lastEvent) return null;

  return (
    <div className="flex items-center gap-1 text-[9px] font-orbitron text-[#8338ec]">
      <Ghost size={10} />
      <span>{lastEvent.type}</span>
      {lastEvent.deck && <span className="text-[#555566]">DECK {lastEvent.deck}</span>}
    </div>
  );
}

export function GhostOverlay() {
  const session = useDJStore((s) => s.session);
  const {
    startSessionRecording,
    stopSessionRecording,
    setSessionPlaying,
    setGhostSpeed,
    setGhostPaused,
  } = useDJStore.getState();

  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionFile, setSessionFile] = useState<SessionFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const eventCount = session.events.length;

  const handleStartRec = useCallback(() => {
    sessionRecorder.start();
  }, []);

  const handleStopRec = useCallback(() => {
    const file = sessionRecorder.stop();
    setSessionFile(file);
    sessionRecorder.exportSession(file);
  }, []);

  const handleLoadGhost = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as SessionFile;
        sessionPlayer.loadSession(data);
        setSessionFile(data);
      } catch {
        console.error('Invalid session file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handlePlayGhost = useCallback(() => {
    if (sessionFile) {
      sessionPlayer.play(session.ghostSpeed);
    }
  }, [sessionFile, session.ghostSpeed]);

  const handlePauseGhost = useCallback(() => {
    if (session.ghostPaused) {
      sessionPlayer.resume();
    } else {
      sessionPlayer.pause();
    }
  }, [session.ghostPaused]);

  const handleStopGhost = useCallback(() => {
    sessionPlayer.stop();
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setGhostSpeed(speed);
    sessionPlayer.setSpeed(speed);
  }, [setGhostSpeed]);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: '#111118', border: '1px solid #2a2a3a', minWidth: 240 }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#1a1a24] transition-colors"
      >
        <Ghost size={13} style={{ color: '#8338ec' }} />
        <span className="text-[10px] font-orbitron font-bold text-white">GHOST SESSION</span>
        <span className="ml-auto text-[8px] text-muted">{isExpanded ? '▾' : '▸'}</span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {/* Recording controls */}
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-rajdhani text-muted uppercase w-12">Record</span>
                {!session.recording ? (
                  <button
                    onClick={handleStartRec}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-[#ff006e44] text-[#ff006e] text-[9px] font-orbitron hover:bg-[#ff006e22]"
                  >
                    ● REC
                  </button>
                ) : (
                  <>
                    <motion.div
                      animate={{ opacity: [1, 0.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="w-2 h-2 rounded-full bg-red-500"
                    />
                    <span className="text-[9px] font-orbitron text-red-400">{eventCount} events</span>
                    <button
                      onClick={handleStopRec}
                      className="flex items-center gap-1 px-2 py-1 rounded border border-[#2a2a3a] text-muted text-[9px] font-orbitron hover:text-white"
                    >
                      <StopCircle size={10} />STOP
                    </button>
                  </>
                )}
              </div>

              <div className="border-t border-[#2a2a3a]" />

              {/* Ghost playback */}
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-rajdhani text-muted uppercase w-12">Ghost</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 rounded border border-[#2a2a3a] text-muted text-[9px] font-orbitron hover:text-white"
                >
                  <Upload size={9} />LOAD
                </button>
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadGhost} />
              </div>

              {sessionFile && (
                <div className="space-y-2">
                  <div className="text-[8px] font-rajdhani text-muted">
                    {sessionFile.events.length} events · {sessionFile.capturedAt?.slice(0, 10)}
                  </div>

                  {/* Speed */}
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-rajdhani text-muted">SPEED</span>
                    {[0.5, 1, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSpeedChange(s)}
                        className="px-1.5 py-0.5 rounded text-[8px] font-orbitron"
                        style={{
                          border: `1px solid ${session.ghostSpeed === s ? '#8338ec' : '#2a2a3a'}`,
                          color: session.ghostSpeed === s ? '#8338ec' : '#555566',
                          backgroundColor: session.ghostSpeed === s ? '#8338ec22' : 'transparent',
                        }}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                  {/* Playback controls */}
                  <div className="flex items-center gap-2">
                    {!session.playing ? (
                      <button
                        onClick={handlePlayGhost}
                        className="flex items-center gap-1 px-2 py-1 rounded border border-[#8338ec44] text-[#8338ec] text-[9px] font-orbitron hover:bg-[#8338ec22]"
                      >
                        <Play size={9} />PLAY GHOST
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handlePauseGhost}
                          className="flex items-center gap-1 px-2 py-1 rounded border border-[#2a2a3a] text-muted text-[9px] font-orbitron hover:text-white"
                        >
                          <Pause size={9} />{session.ghostPaused ? 'RESUME' : 'PAUSE'}
                        </button>
                        <button
                          onClick={handleStopGhost}
                          className="flex items-center gap-1 px-2 py-1 rounded border border-[#2a2a3a] text-muted text-[9px] font-orbitron hover:text-white"
                        >
                          <StopCircle size={9} />STOP
                        </button>
                      </>
                    )}
                  </div>

                  {session.playing && (
                    <GhostIndicator events={sessionFile.events} />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
