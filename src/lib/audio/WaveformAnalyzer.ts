// ─── Waveform Analyzer ──────────────────────────────────────────────────────

/**
 * Generates waveform data from an AudioBuffer.
 * Returns overview data (2000 points) and colored frequency data.
 */
export function generateWaveform(
  audioBuffer: AudioBuffer,
  overviewPoints = 2000
): { waveformData: Float32Array; waveformColors: Uint8Array } {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const samplesPerPoint = Math.floor(length / overviewPoints);

  const waveformData = new Float32Array(overviewPoints);
  const waveformColors = new Uint8Array(overviewPoints * 3); // RGB

  // Get channel data
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  for (let i = 0; i < overviewPoints; i++) {
    const start = i * samplesPerPoint;
    let maxAbs = 0;
    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;

    for (let j = 0; j < samplesPerPoint; j++) {
      let sample = 0;
      for (let c = 0; c < numChannels; c++) {
        sample += channels[c][start + j] ?? 0;
      }
      sample /= numChannels;
      maxAbs = Math.max(maxAbs, Math.abs(sample));
    }
    waveformData[i] = maxAbs;

    // Simple frequency estimation using zero-crossing rate
    let zeroCrossings = 0;
    for (let j = 1; j < samplesPerPoint; j++) {
      const a = channels[0][start + j - 1] ?? 0;
      const b = channels[0][start + j] ?? 0;
      if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) zeroCrossings++;
    }

    const zcRate = zeroCrossings / (samplesPerPoint / audioBuffer.sampleRate);
    // Rough frequency bands via zero-crossing rate
    if (zcRate < 800) {
      // Low frequencies — red
      lowEnergy = 1;
    } else if (zcRate < 4000) {
      // Mid frequencies — green
      midEnergy = 1;
    } else {
      // High frequencies — blue
      highEnergy = 1;
    }

    // Mix based on energy content
    const r = Math.round(lowEnergy * 220 + midEnergy * 0 + highEnergy * 0);
    const g = Math.round(lowEnergy * 50 + midEnergy * 200 + highEnergy * 100);
    const b_val = Math.round(lowEnergy * 0 + midEnergy * 0 + highEnergy * 255);

    waveformColors[i * 3] = r;
    waveformColors[i * 3 + 1] = g;
    waveformColors[i * 3 + 2] = b_val;
  }

  return { waveformData, waveformColors };
}
