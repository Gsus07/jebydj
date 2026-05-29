'use client';

import { useCallback } from 'react';
import { useDJStore } from '@/src/store/useDJStore';
import { useIsNarrow } from '@/src/hooks/useIsNarrow';
import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { getDeckPlayer } from '@/src/lib/audio/DeckPlayer';
import { Knob } from '@/src/components/ui/Knob';
import { CrossFader } from './CrossFader';
import { VUMeter } from './VUMeter';
import { DisplayNumber } from '@/src/components/ui/DisplayNumber';
import { LEDButton } from '@/src/components/ui/LEDButton';

export function Mixer() {
  const mixer = useDJStore((s) => s.mixer);
  const deckA = useDJStore((s) => s.decks.A);
  const deckB = useDJStore((s) => s.decks.B);
  const narrow = useIsNarrow();
  const {
    setCrossfader, setCrossfaderCurve, setMasterGain, setCueMix,
    setCueGain, setMono, setDeckVolume, setDeckEQ, setDeckPFL,
  } = useDJStore.getState();

  const knobSize = narrow ? 26 : 34;
  const vuHeight = narrow ? 70 : 90;
  const masterKnobSize = narrow ? 32 : 40;

  const handleCrossfaderChange = useCallback((position: number) => {
    setCrossfader(position);
    audioEngine.applyCrossfader(position, mixer.crossfaderCurve);
  }, [mixer.crossfaderCurve, setCrossfader]);

  const handleChannelVolumeA = useCallback((v: number) => {
    setDeckVolume('A', v);
    getDeckPlayer('A').setChannelVolume(v);
  }, [setDeckVolume]);

  const handleChannelVolumeB = useCallback((v: number) => {
    setDeckVolume('B', v);
    getDeckPlayer('B').setChannelVolume(v);
  }, [setDeckVolume]);

  const getVULevel = useCallback((deckId: 'A' | 'B') => {
    const player = getDeckPlayer(deckId);
    if (!player.isPlaying) return 0;
    const data = player.getAnalyserData();
    if (data.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return Math.min(1, (sum / data.length / 128) * 2);
  }, []);

  const getMasterVU = useCallback(() => {
    if (!audioEngine.isInitialized()) return 0;
    const data = new Uint8Array(audioEngine.masterAnalyser.frequencyBinCount);
    audioEngine.masterAnalyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return Math.min(1, (sum / data.length / 128) * 2);
  }, []);

  const handleMasterGain = useCallback((v: number) => {
    const gain = v * 2;
    setMasterGain(gain);
    audioEngine.setMasterGain(gain);
  }, [setMasterGain]);

  return (
    <div className="flex flex-col gap-3 p-3 rounded-xl h-full" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3a' }}>
      <div className="text-center text-[10px] font-rajdhani text-muted uppercase tracking-widest">MIXER</div>

      {/* Channel strips */}
      <div className="flex gap-2 justify-center items-start">
        {/* Channel A */}
        <ChannelStrip
          label="A"
          color="#00f5ff"
          volume={deckA.volume}
          eqHigh={deckA.eqHigh}
          eqMid={deckA.eqMid}
          eqLow={deckA.eqLow}
          pflActive={deckA.pfIActive}
          knobSize={knobSize}
          vuHeight={vuHeight}
          onVolumeChange={handleChannelVolumeA}
          onEQHighChange={(v) => { useDJStore.getState().setDeckEQ('A', 'high', v); getDeckPlayer('A').setEQHigh(v); }}
          onEQMidChange={(v) => { useDJStore.getState().setDeckEQ('A', 'mid', v); getDeckPlayer('A').setEQMid(v); }}
          onEQLowChange={(v) => { useDJStore.getState().setDeckEQ('A', 'low', v); getDeckPlayer('A').setEQLow(v); }}
          onPFLToggle={() => setDeckPFL('A', !deckA.pfIActive)}
          getVULevel={() => getVULevel('A')}
        />

        {/* Master section */}
        <div className="flex flex-col items-center gap-2">
          <DisplayNumber
            value={`${Math.round(mixer.masterGain * 100)}%`}
            label="MASTER"
            color="#ffbe0b"
            size="sm"
          />

          {/* Master VU */}
          <VUMeter
            deckId="A"
            getLevel={getMasterVU}
            width={12}
            height={vuHeight}
          />

          <Knob
            value={mixer.masterGain / 2}
            onChange={handleMasterGain}
            size={masterKnobSize}
            label="GAIN"
            color="#ffbe0b"
          />

          {/* Clipping indicator */}
          <div
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor: mixer.masterClipping ? '#ff0000' : '#330000',
              boxShadow: mixer.masterClipping ? '0 0 8px #ff0000' : 'none',
            }}
          />

          {/* Mono toggle */}
          <LEDButton
            active={mixer.isMono}
            color="#ffbe0b"
            onClick={() => setMono(!mixer.isMono)}
            size="sm"
          >
            MONO
          </LEDButton>

          {/* Cue mix */}
          <Knob
            value={mixer.cueMix}
            onChange={setCueMix}
            size={narrow ? 28 : 36}
            label="CUE"
            color="#8338ec"
          />
        </div>

        {/* Channel B */}
        <ChannelStrip
          label="B"
          color="#ff006e"
          volume={deckB.volume}
          eqHigh={deckB.eqHigh}
          eqMid={deckB.eqMid}
          eqLow={deckB.eqLow}
          pflActive={deckB.pfIActive}
          knobSize={knobSize}
          vuHeight={vuHeight}
          onVolumeChange={handleChannelVolumeB}
          onEQHighChange={(v) => { useDJStore.getState().setDeckEQ('B', 'high', v); getDeckPlayer('B').setEQHigh(v); }}
          onEQMidChange={(v) => { useDJStore.getState().setDeckEQ('B', 'mid', v); getDeckPlayer('B').setEQMid(v); }}
          onEQLowChange={(v) => { useDJStore.getState().setDeckEQ('B', 'low', v); getDeckPlayer('B').setEQLow(v); }}
          onPFLToggle={() => setDeckPFL('B', !deckB.pfIActive)}
          getVULevel={() => getVULevel('B')}
        />
      </div>

      {/* Crossfader */}
      <CrossFader
        position={mixer.crossfaderPosition}
        onChange={handleCrossfaderChange}
        curve={mixer.crossfaderCurve}
        onCurveChange={setCrossfaderCurve}
      />
    </div>
  );
}

// ─── Channel Strip ────────────────────────────────────────────────────────────

interface ChannelStripProps {
  label: string;
  color: string;
  volume: number;
  eqHigh: number;
  eqMid: number;
  eqLow: number;
  pflActive: boolean;
  knobSize: number;
  vuHeight: number;
  onVolumeChange: (v: number) => void;
  onEQHighChange: (v: number) => void;
  onEQMidChange: (v: number) => void;
  onEQLowChange: (v: number) => void;
  onPFLToggle: () => void;
  getVULevel: () => number;
}

function ChannelStrip({
  label, color, volume, eqHigh, eqMid, eqLow, pflActive,
  knobSize, vuHeight,
  onVolumeChange, onEQHighChange, onEQMidChange, onEQLowChange,
  onPFLToggle, getVULevel,
}: ChannelStripProps) {
  const toKnob = (v: number) => (v + 1) / 2;
  const fromKnob = (v: number) => v * 2 - 1;

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 52 }}>
      <span className="text-[10px] font-orbitron font-bold" style={{ color }}>CH {label}</span>

      <Knob value={toKnob(eqHigh)} onChange={(v) => onEQHighChange(fromKnob(v))} size={knobSize} label="HI" color={color} />
      <Knob value={toKnob(eqMid)} onChange={(v) => onEQMidChange(fromKnob(v))} size={knobSize} label="MID" color="#8338ec" />
      <Knob value={toKnob(eqLow)} onChange={(v) => onEQLowChange(fromKnob(v))} size={knobSize} label="LO" color="#ff8800" />

      <div className="flex gap-1 items-end">
        <VUMeter deckId={label as 'A' | 'B'} getLevel={getVULevel} width={10} height={vuHeight} />
        <ChannelFader value={volume} onChange={onVolumeChange} color={color} height={vuHeight} />
      </div>

      <LEDButton active={pflActive} color="#8338ec" onClick={onPFLToggle} size="sm">PFL</LEDButton>
    </div>
  );
}

// ─── Channel Fader ────────────────────────────────────────────────────────────

interface ChannelFaderProps {
  value: number;
  onChange: (v: number) => void;
  color: string;
  height: number;
}

function ChannelFader({ value, onChange, color, height }: ChannelFaderProps) {
  return (
    <div className="relative flex flex-col items-center" style={{ height }}>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{
          writingMode: 'vertical-lr',
          direction: 'rtl',
          WebkitAppearance: 'slider-vertical',
          height: height - 10,
          width: 20,
          cursor: 'pointer',
          accentColor: color,
        }}
      />
      <span className="text-[8px] font-orbitron" style={{ color: '#555566' }}>
        {Math.round(value * 100)}
      </span>
    </div>
  );
}
