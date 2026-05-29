'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, X, RefreshCw, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useDJStore } from '@/src/store/useDJStore';

interface MobileControllerModalProps {
  onClose: () => void;
}

const POLL_INTERVAL = 500; // ms

export function MobileControllerModal({ onClose }: MobileControllerModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [connected, setConnected] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setMobileControllerActive } = useDJStore.getState();

  const store = useDJStore.getState();

  // Generate URL and QR on mount
  useEffect(() => {
    const base = window.location.origin;
    const token = Math.random().toString(36).slice(2, 10);
    const controlUrl = `${base}/mobile-controller?session=${token}`;
    setUrl(controlUrl);

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, controlUrl, {
        width: 200,
        color: { dark: '#e8e8f0', light: '#111118' },
        margin: 2,
      }).catch(console.error);
    }
  }, []);

  // 60s countdown
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(tick);
          setMobileControllerActive(false);
          onClose();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [onClose, setMobileControllerActive]);

  // Poll for mobile actions
  useEffect(() => {
    setMobileControllerActive(true);
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/controller/events');
        const data = (await res.json()) as {
          events: Array<{ action: string; value: number; deck: string }>;
        };

        if (data.events.length > 0) setConnected(true);

        for (const ev of data.events) {
          const djStore = useDJStore.getState();
          if (ev.action === 'play' && (ev.deck === 'A' || ev.deck === 'B')) {
            djStore.setDeckPlaying(ev.deck, true);
          } else if (ev.action === 'pause' && (ev.deck === 'A' || ev.deck === 'B')) {
            djStore.setDeckPlaying(ev.deck, false);
          } else if (ev.action === 'crossfader') {
            djStore.setCrossfader(ev.value);
          } else if (ev.action === 'volume') {
            djStore.setMasterGain(ev.value * 2);
          }
        }
      } catch { /* ignore */ }
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setMobileControllerActive(false);
    };
  }, [setMobileControllerActive]);

  const handleClose = useCallback(() => {
    setMobileControllerActive(false);
    onClose();
  }, [onClose, setMobileControllerActive]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          style={{
            backgroundColor: '#111118',
            border: '1px solid #2a2a3a',
            borderRadius: 12,
            padding: '24px',
            width: 300,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <Smartphone size={16} style={{ color: '#00f5ff' }} />
            <span className="text-[12px] font-orbitron font-bold text-white">MOBILE CONTROLLER</span>
            <div className="ml-auto flex items-center gap-2">
              {connected && (
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-2 h-2 rounded-full bg-green-400"
                />
              )}
              <button onClick={handleClose} className="text-muted hover:text-white">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex justify-center mb-3">
            <div className="rounded-lg overflow-hidden" style={{ border: '2px solid #2a2a3a' }}>
              <canvas ref={canvasRef} />
            </div>
          </div>

          {/* URL */}
          <div
            className="text-[8px] font-orbitron text-muted text-center mb-3 break-all px-2"
            style={{ wordBreak: 'break-all' }}
          >{url}</div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <QrCode size={11} className="text-muted" />
              <span className="text-[8px] font-rajdhani text-muted">
                {connected ? 'DEVICE CONNECTED' : 'SCAN WITH PHONE'}
              </span>
            </div>
            <div
              className="text-[9px] font-orbitron"
              style={{ color: countdown < 15 ? '#ff006e' : '#555566' }}
            >
              {countdown}s
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
