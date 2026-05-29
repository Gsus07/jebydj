'use client';

import { useRef, useEffect, useCallback } from 'react';
import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { getDeckPlayer } from '@/src/lib/audio/DeckPlayer';

interface SpectrumAnalyzerProps {
  width?: number;
  height?: number;
  mode?: 'master' | 'dual';
}

export function SpectrumAnalyzer({ width = 800, height = 120, mode = 'dual' }: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const peaksRef = useRef<Float32Array>(new Float32Array(128));
  const peakTimersRef = useRef<Float32Array>(new Float32Array(128));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!audioEngine.isInitialized()) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    const NUM_BARS = 128;
    const barWidth = (w / NUM_BARS) - 1;

    if (mode === 'dual') {
      // Get deck A and B FFT data
      const dataA = new Uint8Array(audioEngine.deckAAnalyser.frequencyBinCount);
      const dataB = new Uint8Array(audioEngine.deckBAnalyser.frequencyBinCount);
      audioEngine.deckAAnalyser.getByteFrequencyData(dataA);
      audioEngine.deckBAnalyser.getByteFrequencyData(dataB);

      const binPerBar = Math.floor(dataA.length / NUM_BARS);

      for (let i = 0; i < NUM_BARS; i++) {
        // Average bins for this bar
        let sumA = 0;
        let sumB = 0;
        for (let j = 0; j < binPerBar; j++) {
          sumA += dataA[i * binPerBar + j] ?? 0;
          sumB += dataB[i * binPerBar + j] ?? 0;
        }
        const valA = sumA / (binPerBar * 255);
        const valB = sumB / (binPerBar * 255);

        const x = i * (barWidth + 1);
        const t = i / NUM_BARS;

        // Deck A: cyan bars from bottom going up (upper half)
        if (valA > 0.01) {
          const barH = valA * (h / 2) * 0.95;
          const gradA = ctx.createLinearGradient(x, h / 2 - barH, x, h / 2);
          gradA.addColorStop(0, `rgba(0, 245, 255, ${0.4 + t * 0.6})`);
          gradA.addColorStop(1, `rgba(0, 100, 180, 0.8)`);
          ctx.fillStyle = gradA;
          ctx.fillRect(x, h / 2 - barH, barWidth, barH);
        }

        // Deck B: magenta bars from bottom going down (lower half)
        if (valB > 0.01) {
          const barH = valB * (h / 2) * 0.95;
          const gradB = ctx.createLinearGradient(x, h / 2, x, h / 2 + barH);
          gradB.addColorStop(0, `rgba(255, 0, 110, 0.8)`);
          gradB.addColorStop(1, `rgba(180, 0, 80, ${0.4 + t * 0.6})`);
          ctx.fillStyle = gradB;
          ctx.fillRect(x, h / 2, barWidth, barH);
        }

        // Peak indicator for combined
        const combined = Math.max(valA, valB);
        if (combined > peaksRef.current[i]) {
          peaksRef.current[i] = combined;
          peakTimersRef.current[i] = 120;
        }
        if (peakTimersRef.current[i] > 0) {
          peakTimersRef.current[i]--;
          const peakY = h / 2 - peaksRef.current[i] * (h / 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fillRect(x, peakY - 1, barWidth, 1);
        } else {
          peaksRef.current[i] *= 0.97;
        }
      }

      // Center line
      ctx.strokeStyle = '#2a2a3a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    } else {
      // Master mode
      const masterData = new Uint8Array(audioEngine.masterAnalyser.frequencyBinCount);
      audioEngine.masterAnalyser.getByteFrequencyData(masterData);
      const binPerBar = Math.floor(masterData.length / NUM_BARS);

      for (let i = 0; i < NUM_BARS; i++) {
        let sum = 0;
        for (let j = 0; j < binPerBar; j++) {
          sum += masterData[i * binPerBar + j] ?? 0;
        }
        const val = sum / (binPerBar * 255);
        const x = i * (barWidth + 1);
        const t = i / NUM_BARS;

        if (val > 0.01) {
          const barH = val * h * 0.95;
          const grad = ctx.createLinearGradient(x, 0, x + NUM_BARS, 0);
          grad.addColorStop(0, '#00f5ff');
          grad.addColorStop(0.5, '#8338ec');
          grad.addColorStop(1, '#ff006e');
          ctx.fillStyle = `rgba(${Math.round(t * 255)}, ${Math.round(100 - t * 50)}, ${Math.round(255 - t * 200)}, 0.9)`;
          ctx.fillRect(x, h - barH, barWidth, barH);
        }
      }
    }

    // Frequency labels
    ctx.fillStyle = '#333344';
    ctx.font = '8px monospace';
    const labels = ['20', '100', '1k', '5k', '10k', '20k'];
    const positions = [0, 0.05, 0.2, 0.6, 0.8, 0.98];
    for (let i = 0; i < labels.length; i++) {
      const x = positions[i] * w;
      ctx.fillText(labels[i], x, h - 2);
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [mode]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full rounded"
      style={{
        border: '1px solid #2a2a3a',
        imageRendering: 'pixelated',
        maxHeight: height,
      }}
    />
  );
}
