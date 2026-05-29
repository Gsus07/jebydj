// AutomationEngine.ts — Computes automation curve values at a given beat

import type { AutomationLane, AutomationPoint, SegmentType } from '@/src/store/dawTypes';

/** Interpolate between two automation points at a given beat */
function interpolate(
  p0: AutomationPoint,
  p1: AutomationPoint,
  beat: number,
): number {
  if (p1.beat <= p0.beat) return p0.value;
  const t = (beat - p0.beat) / (p1.beat - p0.beat);
  const clampedT = Math.max(0, Math.min(1, t));

  switch (p0.segmentType) {
    case 'linear':
      return p0.value + (p1.value - p0.value) * clampedT;

    case 'exponential': {
      // Convex curve: eases in
      const c = Math.pow(clampedT, 2);
      return p0.value + (p1.value - p0.value) * c;
    }

    case 'logarithmic': {
      // Concave curve: eases out
      const c = Math.sqrt(clampedT);
      return p0.value + (p1.value - p0.value) * c;
    }

    case 'hold':
      return p0.value; // hold until next point

    case 'sine': {
      // Smooth S-curve
      const c = 0.5 - Math.cos(clampedT * Math.PI) / 2;
      return p0.value + (p1.value - p0.value) * c;
    }

    default:
      return p0.value + (p1.value - p0.value) * clampedT;
  }
}

/** Get the normalized 0–1 automation value at a given beat */
export function getAutomationValue(lane: AutomationLane, beat: number): number {
  const { points, defaultValue, minValue, maxValue } = lane;
  if (points.length === 0) {
    return (defaultValue - minValue) / (maxValue - minValue);
  }

  // Before first point
  if (beat <= points[0].beat) return points[0].value;

  // After last point
  if (beat >= points[points.length - 1].beat) return points[points.length - 1].value;

  // Find surrounding points
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid].beat <= beat) lo = mid;
    else hi = mid;
  }

  return interpolate(points[lo], points[hi], beat);
}

/** Denormalize value from 0–1 range to actual parameter range */
export function denormalize(normalized: number, min: number, max: number): number {
  return min + normalized * (max - min);
}

/** Normalize value from actual range to 0–1 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/** Get actual parameter value at a given beat for a lane */
export function getAutomationActualValue(lane: AutomationLane, beat: number): number {
  const normalized = getAutomationValue(lane, beat);
  return denormalize(normalized, lane.minValue, lane.maxValue);
}

/** Generate a sampled curve for canvas rendering (N evenly-spaced points) */
export function sampleAutomationCurve(
  lane: AutomationLane,
  startBeat: number,
  endBeat: number,
  samples: number,
): number[] {
  const result: number[] = [];
  const step = (endBeat - startBeat) / samples;
  for (let i = 0; i < samples; i++) {
    result.push(getAutomationValue(lane, startBeat + i * step));
  }
  return result;
}

/** Snap a value to the nearest allowed value for a parameter (e.g., integer steps) */
export function snapValue(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}
