'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `true` when viewport width is below 768px (mobile breakpoint).
 * SSR-safe: defaults to false on the server.
 */
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setNarrow(mq.matches);
    const handler = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return narrow;
}
