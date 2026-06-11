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
    // Determine WS protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use the host of the current site (or default to something else if required)
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Ask for initial state
      ws.send(JSON.stringify({ action: 'get_state' }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'state') {
          setState(msg.payload);
        } else if (msg.type === 'tick') {
          const payload = msg.payload as TickPayload;
          setState(s => ({
            ...s,
            deckA: { ...s.deckA, currentTime: payload.deckA.currentTime },
            deckB: { ...s.deckB, currentTime: payload.deckB.currentTime }
          }));
        } else if (msg.type === 'pong') {
          const rtt = Date.now() - msg.t;
          setLatency(rtt / 2);
        } else if (msg.type === 'beat') {
          // Trigger a global custom event to cause a flash without React re-render
          window.dispatchEvent(new CustomEvent('deck-beat', { detail: { deck: msg.deck } }));
        }
      } catch (err) {
        console.error('WS Parse Error', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Reconnect after 2 seconds
      setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      // It will trigger onclose which handles reconnect
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    
    // Ping/pong every 5s
    const pingIv = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', t: Date.now() }));
      }
    }, 5000);

    return () => {
      clearInterval(pingIv);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const sendMsg = useCallback((msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, latency, state, sendMsg };
}
