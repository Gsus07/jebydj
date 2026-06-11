import React from 'react';
import styles from '../controller.module.css';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  latency: number;
}

export function Drawer({ open, onClose, latency }: DrawerProps) {
  const getSignalColor = (l: number) => {
    if (l === 0) return 'var(--muted)';
    if (l < 50) return '#00ff00';
    if (l < 150) return 'var(--amber)';
    return 'var(--magenta)';
  };

  return (
    <>
      {open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1999 }} onTouchStart={onClose} />
      )}
      <div className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <span style={{ fontWeight: 'bold', letterSpacing: 2 }}>OPCIONES</span>
          <button className={styles.touchBtn} style={{ minWidth: 44, minHeight: 44, border: 'none' }} onTouchStart={onClose}>✕</button>
        </div>
        
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>🎚 Latencia</span>
            <span className={styles.orbitron} style={{ color: getSignalColor(latency) }}>{latency.toFixed(0)} ms</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>🔔 Haptics</span>
            <span style={{ color: 'var(--cyan)' }}>ON [●]</span>
          </div>
          
          <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '8px 0' }} />
          
          <div>
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>🎹 KEYBOARD INPUT</div>
            <div style={{ fontSize: 14 }}>Tocar el piano virtual</div>
          </div>
          
          <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '8px 0' }} />
          
          <div>
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--muted)' }}>⚙ AJUSTES</div>
            <div style={{ fontSize: 14 }}>Reasignar controles</div>
          </div>
          
          <button 
            className={styles.touchBtn} 
            style={{ marginTop: 'auto', borderColor: 'var(--magenta)', color: 'var(--magenta)' }}
            onTouchStart={() => window.location.reload()}
          >
            ✕ DESCONECTAR
          </button>
        </div>
      </div>
    </>
  );
}
