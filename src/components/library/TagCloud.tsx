'use client';

import React from 'react';
import { useSampleStore } from '@/src/store/useSampleStore';

const TAG_COLORS = ['#00f5ff22', '#ff006e22', '#ffbe0b22', '#00cc4422', '#aa44ff22', '#ff660022', '#0088ff22', '#ff44aa22'];
const TAG_TEXT   = ['#00f5ff', '#ff006e', '#ffbe0b', '#00cc44', '#aa44ff', '#ff6600', '#0088ff', '#ff44aa'];

interface Props {
  tags: string[];
  selectedTags: string[];
}

export function TagCloud({ tags, selectedTags }: Props) {
  const setFilters = useSampleStore((s) => s.setFilters);
  const currentTags = useSampleStore((s) => s.filters.tags);

  const toggle = (tag: string) => {
    const next = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    setFilters({ tags: next });
  };

  return (
    <div className="flex flex-wrap gap-1 p-2">
      {tags.map((tag, i) => {
        const active = selectedTags.includes(tag);
        const ci = i % TAG_COLORS.length;
        return (
          <button
            key={tag}
            onClick={() => toggle(tag)}
            className="px-2 py-0.5 rounded-full text-[10px] font-rajdhani transition-all"
            style={{
              background: active ? TAG_COLORS[ci] : 'rgba(255,255,255,0.05)',
              color: active ? TAG_TEXT[ci] : '#555566',
              border: `1px solid ${active ? TAG_TEXT[ci] + '44' : 'transparent'}`,
            }}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
