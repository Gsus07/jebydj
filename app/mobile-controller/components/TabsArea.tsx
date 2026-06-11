import React, { useCallback, useRef } from 'react';
import styles from '../controller.module.css';
import { ControllerState } from './types';

interface TabsAreaProps {
  state: ControllerState;
  sendMsg: (msg: any) => void;
  activeTab: string;
}

export function TabsArea({ state, sendMsg, activeTab }: TabsAreaProps) {
  return (
    <div className={styles.tabContent}>
      {activeTab === 'EQ' && <EQTab state={state.mixer} sendMsg={sendMsg} />}
      {activeTab === 'FX' && <FXTab effects={state.effects} sendMsg={sendMsg} />}
      {activeTab === 'LOOPS' && <LoopsTab deckA={state.deckA} deckB={state.deckB} sendMsg={sendMsg} />}
      {activeTab === 'PADS' && <PadsTab pads={state.sampler.pads} sendMsg={sendMsg} />}
    </div>
  );
}

// ─── EQ Tab ──────────────────────────────────────────────────────────────────
function EQTab({ state, sendMsg }: { state: ControllerState['mixer'], sendMsg: any }) {
  return (
    <div style={{ display: 'flex', height: '100%', gap: 16 }}>
      {['A', 'B'].map((deck) => (
        <div key={deck} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center', color: deck === 'A' ? 'var(--cyan)' : 'var(--magenta)', fontWeight: 'bold' }}>
            DECK {deck}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1 }}>
            {['hi', 'mid', 'lo'].map(band => (
              <VerticalSlider 
                key={band}
                value={(state.eq as any)[deck][band]}
                color={deck === 'A' ? 'var(--cyan)' : 'var(--magenta)'}
                onChange={(val: number) => sendMsg({ action: 'eq', deck, band, value: val })}
                label={band.toUpperCase()}
              />
            ))}
          </div>
          <VerticalSlider 
            value={deck === 'A' ? state.volumeA : state.volumeB}
            color={deck === 'A' ? 'var(--cyan)' : 'var(--magenta)'}
            onChange={(val: number) => sendMsg({ action: 'volume', deck, value: val })}
            label={`VOL ${deck}`}
            height={160}
          />
        </div>
      ))}
    </div>
  );
}

function VerticalSlider({ value, color, onChange, label, height = 120 }: any) {
  const ref = useRef<HTMLDivElement>(null);
  const handleTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const y = e.touches[0].clientY - rect.top;
    let val = 1 - Math.max(0, Math.min(1, y / rect.height));
    onChange(val);
  }, [onChange]);

  const handleDoubleTap = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onChange(0.5); // Reset to center
  }, [onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div 
        ref={ref}
        className={styles.vSliderContainer}
        style={{ height }}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onDoubleClick={handleDoubleTap}
      >
        <div className={styles.vSliderTrack}>
          <div className={styles.vSliderZero} />
          <div 
            className={styles.vSliderThumb} 
            style={{ bottom: `calc(${value * 100}% - 12px)`, borderColor: color }} 
          />
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

// ─── FX Tab ──────────────────────────────────────────────────────────────────
function FXTab({ effects, sendMsg }: { effects: ControllerState['effects'], sendMsg: any }) {
  // Pad the effects to 6 if the server sends fewer
  const displayFX = [...effects];
  while (displayFX.length < 6) {
    displayFX.push({ id: `fx-${displayFX.length}`, name: 'EMPTY', enabled: false, params: [] });
  }
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, height: '100%' }}>
      {displayFX.slice(0, 6).map((fx, i) => (
        <div key={fx.id} style={{ backgroundColor: 'var(--card)', borderRadius: 8, padding: 8, border: `1px solid ${fx.enabled ? 'var(--cyan)' : 'var(--border)'}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button 
            className={styles.touchBtn} 
            style={{ minHeight: 40, borderColor: fx.enabled ? 'var(--cyan)' : 'var(--border)', color: fx.enabled ? 'var(--cyan)' : 'var(--muted)' }}
            onTouchStart={(e) => { e.preventDefault(); sendMsg({ action: 'effect_toggle', effectId: fx.id }); }}
          >
            {fx.name} {fx.enabled ? '●' : '○'}
          </button>
          {fx.params.length > 0 && (
            <input 
              type="range" 
              style={{ width: '100%' }}
              value={fx.params[0].value} 
              onChange={(e) => sendMsg({ action: 'effect_param', effectId: fx.id, param: fx.params[0].name, value: parseFloat(e.target.value) })}
            />
          )}
          <div style={{ fontSize: 9, textAlign: 'center', color: 'var(--muted)' }}>{fx.params[0]?.name || 'PARAM'}</div>
        </div>
      ))}
    </div>
  );
}

// ─── LOOPS Tab ───────────────────────────────────────────────────────────────
function LoopsTab({ deckA, deckB, sendMsg }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {[{ id: 'A', state: deckA }, { id: 'B', state: deckB }].map((d) => (
        <div key={d.id} style={{ flex: 1, backgroundColor: 'var(--card)', borderRadius: 8, padding: 8 }}>
          <div style={{ color: d.id === 'A' ? 'var(--cyan)' : 'var(--magenta)', fontWeight: 'bold', marginBottom: 8 }}>DECK {d.id} LOOPS</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {[0.125, 0.25, 0.5, 1, 2, 4, 8, 16].map(size => (
              <button 
                key={size}
                className={styles.touchBtn}
                style={{ minHeight: 40 }}
                onTouchStart={(e) => { e.preventDefault(); sendMsg({ action: 'loop_size', deck: d.id, beats: size }); }}
              >
                {size >= 1 ? size : `1/${1/size}`}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className={styles.touchBtn} style={{ flex: 1, minHeight: 40 }} onTouchStart={(e) => { e.preventDefault(); sendMsg({ action: 'loop_in', deck: d.id }); }}>IN</button>
            <button className={styles.touchBtn} style={{ flex: 1, minHeight: 40 }} onTouchStart={(e) => { e.preventDefault(); sendMsg({ action: 'loop_out', deck: d.id }); }}>OUT</button>
            <button className={styles.touchBtn} style={{ flex: 1, minHeight: 40, borderColor: 'var(--amber)', color: 'var(--amber)' }} onTouchStart={(e) => { e.preventDefault(); sendMsg({ action: 'loop_toggle', deck: d.id }); }}>ON/OFF</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PADS Tab ────────────────────────────────────────────────────────────────
function PadsTab({ pads, sendMsg }: { pads: ControllerState['sampler']['pads'], sendMsg: any }) {
  const activeBank = 'A'; // Hardcoded for now, can be expanded
  const displayPads = [...pads];
  while (displayPads.length < 16) {
    displayPads.push({ name: '', color: '#333344', hasBuffer: false });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {['A', 'B', 'C', 'D'].map(b => (
          <button key={b} className={styles.touchBtn} style={{ flex: 1, minHeight: 40, borderColor: b === activeBank ? 'var(--cyan)' : 'var(--border)' }}>{b}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, flex: 1 }}>
        {displayPads.slice(0, 16).map((pad, i) => (
          <button 
            key={i}
            className={styles.touchBtn}
            style={{ 
              backgroundColor: pad.hasBuffer ? pad.color : 'var(--surface)', 
              color: pad.hasBuffer ? '#fff' : 'var(--muted)',
              border: pad.hasBuffer ? 'none' : '1px dashed var(--border)',
              opacity: pad.hasBuffer ? 0.8 : 1
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              if (navigator.vibrate) navigator.vibrate(10);
              sendMsg({ action: 'pad', padIndex: i, bank: activeBank });
              // Simple visual feedback
              const target = e.currentTarget;
              target.style.opacity = '1';
              target.style.transform = 'scale(0.95)';
              setTimeout(() => { target.style.opacity = pad.hasBuffer ? '0.8' : '1'; target.style.transform = 'none'; }, 100);
            }}
          >
            {pad.hasBuffer ? pad.name : '+'}
          </button>
        ))}
      </div>
    </div>
  );
}
