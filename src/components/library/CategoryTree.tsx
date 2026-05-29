'use client';

import React from 'react';
import { ChevronRight, ChevronDown, Folder, Star, Clock, User } from 'lucide-react';
import type { SampleCategory } from '@/src/store/sampleTypes';
import { useSampleStore } from '@/src/store/useSampleStore';

interface TreeNode {
  id: SampleCategory;
  label: string;
  children?: TreeNode[];
  icon?: React.ReactNode;
}

const TREE: TreeNode[] = [
  {
    id: 'all', label: 'All Samples', icon: <Folder size={11} />,
  },
  {
    id: 'favorites', label: 'Favorites ★', icon: <Star size={11} style={{ color: '#ffbe0b' }} />,
  },
  {
    id: 'recent', label: 'Recently Used', icon: <Clock size={11} />,
  },
  {
    id: 'user', label: 'My Samples', icon: <User size={11} />,
  },
  {
    id: 'kicks', label: 'Drums & Percussion',
    children: [
      { id: 'kicks', label: 'Kicks' },
      { id: 'snares', label: 'Snares & Claps' },
      { id: 'hihat', label: 'Hi-Hats' },
      { id: 'cymbals', label: 'Cymbals & Rides' },
      { id: 'toms', label: 'Toms' },
      { id: 'percussion', label: 'Percussion' },
      { id: 'drum-loops', label: 'Drum Loops' },
    ],
  },
  {
    id: '808s', label: 'Bass',
    children: [
      { id: 'bass-drops', label: 'Bass Drops' },
      { id: '808s', label: '808s' },
      { id: 'sub-hits', label: 'Sub Hits' },
      { id: 'bass-loops', label: 'Bass Loops' },
    ],
  },
  {
    id: 'drops', label: 'FX & Transitions',
    children: [
      { id: 'drops', label: 'Drops & Impacts' },
      { id: 'rises', label: 'Rises & Build-ups' },
      { id: 'downlifters', label: 'Downlifters' },
      { id: 'sweeps', label: 'Sweeps & Whooshes' },
      { id: 'vinyl', label: 'Vinyl Scratches' },
      { id: 'crowd', label: 'Crowd FX' },
      { id: 'noise', label: 'White Noise' },
    ],
  },
  {
    id: 'chord-loops', label: 'Melodic Loops',
    children: [
      { id: 'chord-loops', label: 'Chord Loops' },
      { id: 'melody-loops', label: 'Melody Loops' },
      { id: 'vocal-chops', label: 'Vocal Chops' },
    ],
  },
  {
    id: 'piano-shots', label: 'One-Shots',
    children: [
      { id: 'piano-shots', label: 'Piano' },
      { id: 'synth-shots', label: 'Synth' },
      { id: 'strings-shots', label: 'Strings' },
    ],
  },
];

export function CategoryTree() {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set(['kicks', 'drops']));
  const activeCategory = useSampleStore((s) => s.filters.category);
  const setFilters = useSampleStore((s) => s.setFilters);
  const samples = useSampleStore((s) => s.samples);

  const countFor = (cat: SampleCategory): number => {
    if (cat === 'all') return samples.length;
    if (cat === 'favorites') return samples.filter((s) => s.isFavorite).length;
    if (cat === 'user') return samples.filter((s) => s.packId === 'user').length;
    if (cat === 'recent') { const c = Date.now() - 7 * 24 * 3600 * 1000; return samples.filter((s) => (s.lastUsedAt ?? 0) > c).length; }
    return samples.filter((s) => s.category === cat).length;
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const isActive = activeCategory === node.id;
    const count = countFor(node.id);

    return (
      <div key={`${node.id}-${depth}`}>
        <div
          className="flex items-center gap-1 px-2 h-7 cursor-pointer select-none rounded mx-1 transition-colors"
          style={{
            paddingLeft: `${8 + depth * 12}px`,
            background: isActive ? 'rgba(0,245,255,0.1)' : 'transparent',
            color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
          }}
          onClick={() => {
            if (hasChildren) toggleExpand(node.id);
            setFilters({ category: node.id });
          }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />
          ) : (
            <span style={{ width: 10, display: 'inline-block' }} />
          )}
          {node.icon && <span className="shrink-0">{node.icon}</span>}
          <span className="text-[11px] flex-1 truncate" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            {node.label}
          </span>
          {count > 0 && (
            <span className="text-[9px] px-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
              {count}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && node.children?.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex flex-col overflow-y-auto py-1" style={{ background: 'var(--bg-surface)' }}>
      {TREE.map((node) => renderNode(node))}
    </div>
  );
}
