// ─── BPM Detector ───────────────────────────────────────────────────────────

export function detectBPM(audioBuffer: AudioBuffer): number {
  // Use onset detection on the mono mixdown
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;

  // Mix to mono
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < numChannels; c++) {
    const ch = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      mono[i] += ch[i] / numChannels;
    }
  }

  // Compute onset strength signal using energy difference
  const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
  const hopSize = Math.floor(frameSize / 2);
  const numFrames = Math.floor((length - frameSize) / hopSize);
  const onsetStrength = new Float32Array(numFrames);

  let prevEnergy = 0;
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += mono[start + j] ** 2;
    }
    energy /= frameSize;
    const diff = Math.max(0, energy - prevEnergy);
    onsetStrength[i] = diff;
    prevEnergy = energy;
  }

  // Auto-correlate the onset strength to find beat period
  const hopDuration = hopSize / sampleRate; // seconds per hop
  const minBPM = 60;
  const maxBPM = 200;
  const minPeriodFrames = Math.floor(60 / (maxBPM * hopDuration));
  const maxPeriodFrames = Math.floor(60 / (minBPM * hopDuration));

  let bestPeriod = minPeriodFrames;
  let bestCorr = -1;

  for (let period = minPeriodFrames; period <= maxPeriodFrames; period++) {
    let corr = 0;
    let count = 0;
    for (let i = 0; i + period < numFrames; i++) {
      corr += onsetStrength[i] * onsetStrength[i + period];
      count++;
    }
    if (count > 0) {
      corr /= count;
      if (corr > bestCorr) {
        bestCorr = corr;
        bestPeriod = period;
      }
    }
  }

  const bpm = 60 / (bestPeriod * hopDuration);

  // Normalize to 60-180 BPM range
  let normalizedBpm = bpm;
  while (normalizedBpm < 60) normalizedBpm *= 2;
  while (normalizedBpm > 180) normalizedBpm /= 2;

  return Math.round(normalizedBpm * 10) / 10;
}

// Detect musical key using Krumhansl-Schmuckler algorithm
export function detectKey(audioBuffer: AudioBuffer): string {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;

  // Mix to mono
  const length = Math.min(audioBuffer.length, sampleRate * 30); // analyze first 30s
  const mono = new Float32Array(length);
  for (let c = 0; c < numChannels; c++) {
    const ch = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      mono[i] += ch[i] / numChannels;
    }
  }

  // Simple chromagram via DFT at specific frequencies
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const chromagram = new Float32Array(12);
  const frameSize = 4096;
  const hopSize = frameSize / 2;
  const numFrames = Math.floor((length - frameSize) / hopSize);

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    for (let n = 0; n < 12; n++) {
      // Middle octave frequencies (octave 4-5)
      for (let octave = 3; octave <= 6; octave++) {
        const freq = 261.63 * Math.pow(2, (n / 12) + (octave - 4)); // C4 = 261.63 Hz
        let real = 0;
        let imag = 0;
        for (let i = 0; i < frameSize; i++) {
          const angle = (2 * Math.PI * freq * i) / sampleRate;
          real += mono[start + i] * Math.cos(angle);
          imag += mono[start + i] * Math.sin(angle);
        }
        chromagram[n] += Math.sqrt(real * real + imag * imag);
      }
    }
  }

  // Normalize
  const maxVal = Math.max(...chromagram);
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) chromagram[i] /= maxVal;
  }

  // Krumhansl-Schmuckler key profiles
  const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  let bestKey = 'C';
  let bestCorr = -Infinity;

  for (let tonic = 0; tonic < 12; tonic++) {
    // Major
    let corrMaj = 0;
    for (let i = 0; i < 12; i++) {
      corrMaj += chromagram[(i + tonic) % 12] * majorProfile[i];
    }
    if (corrMaj > bestCorr) {
      bestCorr = corrMaj;
      bestKey = notes[tonic] + 'm' === notes[tonic] ? notes[tonic] : notes[tonic];
    }

    // Minor
    let corrMin = 0;
    for (let i = 0; i < 12; i++) {
      corrMin += chromagram[(i + tonic) % 12] * minorProfile[i];
    }
    if (corrMin > bestCorr) {
      bestCorr = corrMin;
      bestKey = notes[tonic] + 'm';
    }
  }

  return bestKey;
}
