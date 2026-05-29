'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { useSampleStore } from '@/src/store/useSampleStore';

interface Props {
  sampleId: string;
  isFavorite: boolean;
}

export function FavoritesStar({ sampleId, isFavorite }: Props) {
  const toggle = useSampleStore((s) => s.toggleFavorite);

  return (
    <button
      className="flex items-center justify-center w-5 h-5 rounded"
      onClick={(e) => { e.stopPropagation(); toggle(sampleId); }}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      style={{ color: isFavorite ? '#ffbe0b' : '#333344' }}
    >
      <Star size={12} fill={isFavorite ? '#ffbe0b' : 'none'} />
    </button>
  );
}
