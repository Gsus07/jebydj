// SessionRecorder — captures DJ actions as timestamped events
'use client';

import type { SessionEvent, SessionFile } from './types';
import { useDJStore } from '../../store/useDJStore';

class SessionRecorderClass {
  private _recording = false;
  private _startTime = 0;

  get isRecording() { return this._recording; }

  start(): void {
    this._recording = true;
    this._startTime = Date.now();
    useDJStore.getState().startSessionRecording();
  }

  stop(): SessionFile {
    this._recording = false;
    const state = useDJStore.getState();
    state.stopSessionRecording();

    const store = state;
    const tracks = (['A', 'B'] as const).map((id) => ({
      name: store.decks[id].trackName,
      bpm: store.decks[id].bpm,
      key: store.decks[id].key,
    }));

    return {
      version: 1,
      capturedAt: new Date().toISOString(),
      tracks,
      events: [...state.session.events],
    };
  }

  emit(type: SessionEvent['type'], deck?: 'A' | 'B', payload: Record<string, unknown> = {}): void {
    if (!this._recording) return;
    const event: SessionEvent = {
      t: Date.now() - this._startTime,
      type,
      deck,
      payload,
    };
    useDJStore.getState().addSessionEvent(event);
  }

  exportSession(session: SessionFile): void {
    const json = JSON.stringify(session, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dj-session-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const sessionRecorder = new SessionRecorderClass();
