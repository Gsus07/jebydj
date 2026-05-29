// SessionPlayer — replays ghost session events as visual animations
'use client';

import type { SessionEvent, SessionFile } from './types';
import { useDJStore } from '../../store/useDJStore';

export type GhostEventCallback = (event: SessionEvent) => void;

class SessionPlayerClass {
  private _events: SessionEvent[] = [];
  private _startTime = 0;
  private _speed = 1;
  private _paused = false;
  private _playing = false;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _listeners: GhostEventCallback[] = [];
  private _eventIndex = 0;

  addListener(fn: GhostEventCallback): () => void {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  }

  private emit(event: SessionEvent): void {
    this._listeners.forEach((l) => l(event));
  }

  loadSession(session: SessionFile): void {
    this._events = session.events;
    useDJStore.getState().loadGhostSession(session.events);
  }

  play(speed = 1): void {
    if (this._playing) this.stop();
    this._speed = speed;
    this._playing = true;
    this._paused = false;
    this._startTime = Date.now();
    this._eventIndex = 0;
    useDJStore.getState().setSessionPlaying(true);
    this._scheduleNext();
  }

  pause(): void {
    this._paused = true;
    useDJStore.getState().setGhostPaused(true);
    if (this._timer) clearTimeout(this._timer);
  }

  resume(): void {
    if (!this._playing || !this._paused) return;
    this._paused = false;
    useDJStore.getState().setGhostPaused(false);
    this._scheduleNext();
  }

  stop(): void {
    this._playing = false;
    this._paused = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    useDJStore.getState().setSessionPlaying(false);
  }

  setSpeed(speed: number): void {
    this._speed = speed;
    useDJStore.getState().setGhostSpeed(speed);
  }

  get isPlaying() { return this._playing && !this._paused; }
  get isPaused() { return this._paused; }

  private _scheduleNext(): void {
    if (!this._playing || this._paused) return;
    if (this._eventIndex >= this._events.length) {
      this.stop();
      return;
    }

    const event = this._events[this._eventIndex];
    const elapsed = (Date.now() - this._startTime) * this._speed;
    const delay = Math.max(0, event.t / this._speed - elapsed);

    this._timer = setTimeout(() => {
      if (!this._playing || this._paused) return;
      this.emit(event);
      this._eventIndex++;
      this._scheduleNext();
    }, delay);
  }
}

export const sessionPlayer = new SessionPlayerClass();
