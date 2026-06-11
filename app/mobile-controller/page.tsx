'use client';

import React, { useEffect, useState, useCallback } from 'react';
import styles from './controller.module.css';
import { useMobileController } from './components/useMobileController';
import { DeckControls } from './components/DeckControls';
import { Crossfader } from './components/Crossfader';
import { TabsArea } from './components/TabsArea';
import { PitchSlider } from './components/PitchSlider';
import { Drawer } from './components/Drawer';

export default function MobileControllerPage() {
  const { connected, latency, state, sendMsg } = useMobileController();
  const [activeTab, setActiveTab] = useState<'EQ' | 'FX' | 'LOOPS' | 'PADS'>('EQ');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pitchDeck, setPitchDeck] = useState<'A' | 'B' | null>(null);
  const [isPortrait, setIsPortrait] = useState(true);

  // Layout & Setup
  useEffect(() => {
    // Basic setup
    document.body.style.overscrollBehavior = 'none';
    const preventContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', preventContext);

    // Orientation
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);

    // Fullscreen and WakeLock on connect
    if (connected) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      if ('wakeLock' in navigator) {
        (navigator as any).wakeLock.request('screen').catch(() => {});
      }
    }

    return () => {
      document.body.style.overscrollBehavior = 'auto';
      document.removeEventListener('contextmenu', preventContext);
      window.removeEventListener('resize', checkOrientation);
    };
  }, [connected]);

  if (!connected) {
    return (
      <div className={styles.overlay}>
        <div style={{ textAlign: 'center' }}>
          <div className={styles.orbitron} style={{ fontSize: 24, color: 'var(--cyan)' }}>🎛 JEBY DJ</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', letterSpacing: 2 }}>Mobile Controller</div>
        </div>
        <div style={{ padding: '16px 32px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <span>Conectando</span>
            <div className={styles.statusDot} style={{ backgroundColor: 'var(--amber)', animation: 'pulse 1s infinite' }} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Asegúrate de que el servidor WS esté corriendo.
        </div>
        <button 
          className={styles.touchBtn} 
          style={{ width: 200, marginTop: 32 }}
          onClick={() => window.location.reload()}
        >
          Volver a intentar
        </button>
      </div>
    );
  }

  // Common Header
  const Header = (
    <div className={styles.header}>
      <div className={styles.statusIndicator}>
        <div className={styles.statusDot} style={{ backgroundColor: latency < 50 ? '#00ff00' : (latency < 150 ? 'var(--amber)' : 'var(--magenta)') }} />
        <span className={styles.orbitron}>CONECTADO</span>
      </div>
      <div className={`${styles.orbitron} ${styles.headerTitle}`}>
        <span style={{ color: 'var(--cyan)' }}>JEBY</span><span style={{ color: 'var(--magenta)' }}>DJ</span>
      </div>
      <button className={`${styles.menuBtn} ${styles.orbitron}`} onTouchStart={(e) => { e.preventDefault(); setDrawerOpen(true); }}>
        ≡ MENÚ
      </button>
    </div>
  );

  // Common Tabs Bar
  const TabsBar = (
    <div className={styles.tabHeader}>
      {(['EQ', 'FX', 'LOOPS', 'PADS'] as const).map(tab => (
        <button
          key={tab}
          className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
          onTouchStart={(e) => { e.preventDefault(); setActiveTab(tab); }}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  return (
    <div className={styles.container}>
      {isPortrait && Header}

      {isPortrait ? (
        <div className={styles.layoutPortrait}>
          {/* Deck Info & Controls A */}
          <div style={{ position: 'relative' }}>
            <DeckControls deckId="A" state={state.deckA} sendMsg={sendMsg} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40 }} onTouchStart={(e) => { e.preventDefault(); setPitchDeck('A'); }} />
          </div>
          
          {/* Deck Info & Controls B */}
          <div style={{ position: 'relative' }}>
            <DeckControls deckId="B" state={state.deckB} sendMsg={sendMsg} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40 }} onTouchStart={(e) => { e.preventDefault(); setPitchDeck('B'); }} />
          </div>
          
          <Crossfader value={state.mixer.crossfader} sendMsg={sendMsg} />
          
          <div className={styles.tabsArea}>
            {TabsBar}
            <TabsArea activeTab={activeTab} state={state} sendMsg={sendMsg} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
          {Header}
          <div className={styles.layoutLandscape}>
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
               <DeckControls deckId="A" state={state.deckA} sendMsg={sendMsg} />
               <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40 }} onTouchStart={(e) => { e.preventDefault(); setPitchDeck('A'); }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 0', backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
              <div style={{ writingMode: 'vertical-rl', textAlign: 'center', flex: 1, color: 'var(--muted)', fontSize: 10, letterSpacing: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>CROSSFADER</div>
               <Crossfader value={state.mixer.crossfader} sendMsg={sendMsg} vertical={true} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
               <DeckControls deckId="B" state={state.deckB} sendMsg={sendMsg} />
               <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40 }} onTouchStart={(e) => { e.preventDefault(); setPitchDeck('B'); }} />
            </div>
          </div>
          
          <div className={styles.tabsArea} style={{ height: '40vh', borderTop: '1px solid var(--border)' }}>
            {TabsBar}
            <TabsArea activeTab={activeTab} state={state} sendMsg={sendMsg} />
          </div>
        </div>
      )}

      {/* Slide-in Pitch */}
      {pitchDeck && (
        <PitchSlider 
          deckId={pitchDeck} 
          bpm={pitchDeck === 'A' ? state.deckA.bpm : state.deckB.bpm} 
          sendMsg={sendMsg} 
          onClose={() => setPitchDeck(null)} 
        />
      )}

      {/* Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} latency={latency} />
    </div>
  );
}
