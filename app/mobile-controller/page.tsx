'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDJStore } from '@/src/store/useDJStore';

const SEND = '/api/controller/send';

async function sendAction(action: string, value: number, deck: string) {
  try {
    await fetch(SEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, value, deck }),
    });
  } catch {
    // fail silently on mobile
  }
}

export default function MobileControllerPage() {
  const [crossfader, setCrossfader] = useState(0); // -1 to 1
  const [volume, setVolume] = useState(0.8);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartVal, setDragStartVal] = useState(0);
  const [effects, setEffects] = useState([false, false, false, false]);
  const [bpm, setBpm] = useState(0);

  // Poll BPM from server (could extend to fetch deck state)
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch('/api/controller/events');
        const data = (await res.json()) as { events: Array<{ action: string; value: number }> };
        const bpmEvent = data.events.find((e) => e.action === 'bpm');
        if (bpmEvent) setBpm(bpmEvent.value);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const handlePlayA = useCallback(() => { sendAction('play', 1, 'A'); }, []);
  const handlePlayB = useCallback(() => { sendAction('play', 1, 'B'); }, []);
  const handlePauseA = useCallback(() => { sendAction('pause', 1, 'A'); }, []);
  const handlePauseB = useCallback(() => { sendAction('pause', 1, 'B'); }, []);

  const handleCrossfaderTouch = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStartX(touch.clientX);
    setDragStartVal(crossfader);
  }, [crossfader]);

  const handleCrossfaderMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = (touch.clientX - dragStartX) / 150; // 150px = full range
    const newVal = Math.max(-1, Math.min(1, dragStartVal + dx));
    setCrossfader(newVal);
    sendAction('crossfader', newVal, 'master');
  }, [isDragging, dragStartX, dragStartVal]);

  const handleCrossfaderEnd = useCallback(() => setIsDragging(false), []);

  const toggleEffect = useCallback((i: number) => {
    setEffects((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      sendAction('effect', next[i] ? 1 : 0, `fx${i}`);
      return next;
    });
  }, []);

  const EFFECT_LABELS = ['REVERB', 'DELAY', 'FILTER', 'CRUSH'];
  const EFFECT_COLORS = ['#00f5ff', '#ff006e', '#ffbe0b', '#8338ec'];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between"
      style={{ backgroundColor: '#0a0a0f', padding: '20px 16px', fontFamily: 'Orbitron, monospace', color: '#e8e8f0' }}
    >
      {/* Header */}
      <div className="text-center mb-4">
        <div style={{ fontSize: 12, color: '#555566', letterSpacing: 4 }}>JEBY DJ</div>
        <div style={{ fontSize: 10, color: '#555566' }}>MOBILE CONTROLLER</div>
        {bpm > 0 && <div style={{ fontSize: 18, color: '#ffbe0b', marginTop: 4 }}>{bpm.toFixed(1)} BPM</div>}
      </div>

      {/* Play/Pause buttons */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
        {(['A', 'B'] as const).map((deck) => (
          <div key={deck} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 10, color: deck === 'A' ? '#00f5ff' : '#ff006e', letterSpacing: 3 }}>DECK {deck}</div>
            <button
              onTouchStart={deck === 'A' ? handlePlayA : handlePlayB}
              style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: deck === 'A' ? '#00f5ff22' : '#ff006e22',
                border: `2px solid ${deck === 'A' ? '#00f5ff' : '#ff006e'}`,
                color: deck === 'A' ? '#00f5ff' : '#ff006e',
                fontSize: 20,
              }}
            >▶</button>
            <button
              onTouchStart={deck === 'A' ? handlePauseA : handlePauseB}
              style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: '#1a1a24',
                border: '2px solid #2a2a3a',
                color: '#555566',
                fontSize: 20,
              }}
            >⏸</button>
          </div>
        ))}
      </div>

      {/* Crossfader */}
      <div style={{ width: '100%', maxWidth: 300, marginBottom: 32 }}>
        <div style={{ fontSize: 9, color: '#555566', textAlign: 'center', marginBottom: 8, letterSpacing: 2 }}>
          CROSSFADER
        </div>
        <div
          style={{
            position: 'relative', height: 48, borderRadius: 24,
            backgroundColor: '#1a1a24', border: '1px solid #2a2a3a',
            userSelect: 'none',
          }}
          onTouchStart={handleCrossfaderTouch}
          onTouchMove={handleCrossfaderMove}
          onTouchEnd={handleCrossfaderEnd}
        >
          {/* Track */}
          <div style={{
            position: 'absolute', top: '50%', left: '5%', right: '5%', height: 2,
            transform: 'translateY(-50%)', backgroundColor: '#2a2a3a',
          }} />
          {/* Thumb */}
          <div style={{
            position: 'absolute', top: '50%', width: 40, height: 40, borderRadius: 20,
            transform: 'translate(-50%, -50%)',
            left: `${((crossfader + 1) / 2) * 90 + 5}%`,
            backgroundColor: '#ffbe0b',
            boxShadow: '0 0 10px #ffbe0b66',
            transition: isDragging ? 'none' : 'left 0.1s',
          }} />
          <div style={{ position: 'absolute', bottom: 2, left: 8, fontSize: 8, color: '#00f5ff' }}>A</div>
          <div style={{ position: 'absolute', bottom: 2, right: 8, fontSize: 8, color: '#ff006e' }}>B</div>
        </div>
      </div>

      {/* Master volume */}
      <div style={{ width: '100%', maxWidth: 300, marginBottom: 32 }}>
        <div style={{ fontSize: 9, color: '#555566', textAlign: 'center', marginBottom: 8, letterSpacing: 2 }}>
          MASTER VOL — {Math.round(volume * 100)}%
        </div>
        <input
          type="range" min={0} max={1} step={0.01} value={volume}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setVolume(v);
            sendAction('volume', v, 'master');
          }}
          style={{ width: '100%', accentColor: '#00f5ff', height: 8 }}
        />
      </div>

      {/* Effects */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 300 }}>
        {EFFECT_LABELS.map((label, i) => (
          <button
            key={label}
            onTouchStart={() => toggleEffect(i)}
            style={{
              height: 56, borderRadius: 8, fontSize: 10, letterSpacing: 2,
              backgroundColor: effects[i] ? `${EFFECT_COLORS[i]}33` : '#1a1a24',
              border: `2px solid ${effects[i] ? EFFECT_COLORS[i] : '#2a2a3a'}`,
              color: effects[i] ? EFFECT_COLORS[i] : '#555566',
              boxShadow: effects[i] ? `0 0 12px ${EFFECT_COLORS[i]}44` : 'none',
            }}
          >{label}</button>
        ))}
      </div>
    </div>
  );
}
