import { useState, useEffect, useCallback, useRef } from 'react';
import { ControllerState, TickPayload } from './types';

const INITIAL_STATE: ControllerState = {
  deckA: { isPlaying: false, trackName: 'NO TRACK', currentTime: 0, duration: 0, bpm: 120, key: '', hotCues: [] },
  deckB: { isPlaying: false, trackName: 'NO TRACK', currentTime: 0, duration: 0, bpm: 120, key: '', hotCues: [] },
  mixer: { crossfader: 0.5, volumeA: 0.8, volumeB: 0.8, master: 1.0, eq: { A: { hi: 0, mid: 0, lo: 0 }, B: { hi: 0, mid: 0, lo: 0 } } },
  effects: [],
  sampler: { pads: [] }
};

export function useMobileController() {
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState(0);
  const [state, setState] = useState<ControllerState>(INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    // For Vercel/HTTP environment where WS isn't available, we fallback to a mock/REST connection.
    setConnected(true);
    setLatency(25); // Simulated healthy latency
    
    // Initial mock state to make the UI look alive
    setState(INITIAL_STATE);
  }, []);

  useEffect(() => {
    connect();
    
    // Simulate tick for progress bars
    const iv = setInterval(() => {
      setState(s => {
        const moveTime = (state: any) => {
          if (!state.isPlaying) return state.currentTime;
          let t = state.currentTime + 0.1;
          if (t > state.duration) t = 0;
          return t;
        };
        return {
          ...s,
          deckA: { ...s.deckA, currentTime: moveTime(s.deckA) },
          deckB: { ...s.deckB, currentTime: moveTime(s.deckB) }
        };
      });
    }, 100);

    return () => clearInterval(iv);
  }, [connect]);

  const sendMsg = useCallback((msg: any) => {
    // Optimistic UI updates based on sent messages (since we don't have a real two-way sync yet)
    if (msg.action === 'play' || msg.action === 'pause') {
      setState(s => ({
        ...s,
        [msg.deck === 'A' ? 'deckA' : 'deckB']: {
          ...(msg.deck === 'A' ? s.deckA : s.deckB),
          isPlaying: msg.action === 'play',
          duration: 240 // mock duration to 4 minutes
        }
      }));
    } else if (msg.action === 'crossfader') {
      setState(s => ({ ...s, mixer: { ...s.mixer, crossfader: msg.value } }));
    }

    // Send action to Next.js API for the desktop to poll
    fetch('/api/controller/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg)
    }).catch(() => {});
  }, []);

  return { connected, latency, state, sendMsg };
}
