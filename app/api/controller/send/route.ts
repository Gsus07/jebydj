// Mobile → server: POST an action
import { NextResponse } from 'next/server';
import { controllerEventQueue } from '../events/route';

interface MobileAction {
  action: 'play' | 'pause' | 'crossfader' | 'volume' | 'effect';
  value: number;
  deck: 'A' | 'B' | 'master';
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, value, deck } = body as MobileAction;
  if (!action || value === undefined || !deck) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Limit queue size
  if (controllerEventQueue.length < 100) {
    controllerEventQueue.push({ action, value, deck, ts: Date.now() });
  }

  return NextResponse.json({ ok: true });
}
