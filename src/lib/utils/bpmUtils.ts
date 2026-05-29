// ─── BPM Utils ──────────────────────────────────────────────────────────────

export function tempoToPlaybackRate(
  detectedBpm: number,
  targetBpm: number
): number {
  if (detectedBpm <= 0) return 1;
  return targetBpm / detectedBpm;
}

export function playbackRateToTempoPercent(rate: number): number {
  return (rate - 1) * 100;
}

export function pitchSemitonesToRate(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

export function harmonicCompatibility(
  keyA: string,
  keyB: string
): 'perfect' | 'adjacent' | 'relative' | 'none' {
  if (keyA === keyB) return 'perfect';

  const notes = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

  const extractRoot = (k: string): { root: string; isMinor: boolean } => {
    const isMinor = k.endsWith('m');
    const root = isMinor ? k.slice(0, -1) : k;
    return { root, isMinor };
  };

  const a = extractRoot(keyA);
  const b = extractRoot(keyB);

  const idxA = notes.indexOf(a.root);
  const idxB = notes.indexOf(b.root);

  if (idxA === -1 || idxB === -1) return 'none';

  const diff = Math.abs(idxA - idxB);
  const circleDiff = Math.min(diff, 12 - diff);

  if (a.isMinor === b.isMinor) {
    if (circleDiff === 1) return 'adjacent';
  } else {
    // Relative major/minor: same key signature
    if (circleDiff === 3) return 'relative';
  }

  return 'none';
}

export function beatSizes(): number[] {
  return [0.125, 0.25, 0.5, 1, 2, 4, 8, 16];
}

export function beatSizeLabel(size: number): string {
  if (size < 1) return `1/${Math.round(1 / size)}`;
  return `${size}`;
}
