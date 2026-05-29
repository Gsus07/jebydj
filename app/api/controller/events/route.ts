// SSE endpoint: desktop polls this for mobile controller events
import { NextResponse } from 'next/server';

// In-memory queue (works for single Next.js process)
export const controllerEventQueue: Array<{ action: string; value: number; deck: string; ts: number }> = [];

export async function GET() {
  // Return current queue and clear it
  const events = controllerEventQueue.splice(0, controllerEventQueue.length);
  return NextResponse.json({ events });
}
