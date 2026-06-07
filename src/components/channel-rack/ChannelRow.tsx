'use client';

import React, { useState, useCallback } from 'react';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import type { Channel, StepData } from '@/src/store/useChannelRackStore';
import { Knob } from '@/src/components/ui/Knob';
import { Volume2, VolumeX } from 'lucide-react';

// ─── Color Picker (16 colors) ────────────────────────────────────────────────

const PALETTE = [
  '#ff006e', '#ff4444', '#ff8800', '#ffbe0b',
  '#06d6a0', '#00f5ff', '#3a86ff', '#8338ec',
  '#e91e63', '#f44336', '#ff9800', '#4caf50',
  '#00bcd4', '#2196f3', '#9c27b0', '#795548',
];

function ColorDot({
  color,
  onClick,
}: {
  color: string;
  onClick: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const { updateChannel } = useChannelRackStore();

  return (
    <div className="relative">
      <button
        className="w-4 h-4 rounded-full flex-shrink-0 border border-white/10 hover:scale-110 transition-transform"
        style={{ background: color }}
        onClick={() => setShowPicker(!showPicker)}
      />
      {showPicker && (
        <div
          className="absolute top-6 left-0 z-50 p-2 rounded-lg grid grid-cols-4 gap-1"
          style={{
            background: 'rgba(18,18,30,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          }}
        >
          {PALETTE.map((c) => (
            <button
              key={c}
              className="w-5 h-5 rounded-full hover:scale-125 transition-transform"
              style={{ background: c, border: c === color ? '2px solid #fff' : '1px solid transparent' }}
              onClick={() => {
                onClick();
                setShowPicker(false);
              }}
              onMouseDown={() => {
                // Update happens via parent
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step Button ─────────────────────────────────────────────────────────────

function StepButton({
  step,
  index,
  color,
  isCurrent,
  onToggle,
  groupOf4,
}: {
  step: StepData;
  index: number;
  color: string;
  isCurrent: boolean;
  onToggle: () => void;
  groupOf4: number;
}) {
  const isGroupDark = groupOf4 % 2 === 1;

  return (
    <button
      className="flex-shrink-0 rounded-sm transition-all"
      style={{
        width: 18,
        height: 18,
        background: step.on
          ? color
          : isGroupDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        border: isCurrent
          ? '1.5px solid #fff'
          : step.on
          ? `1px solid ${color}`
          : '1px solid rgba(255,255,255,0.06)',
        opacity: step.on ? (step.velocity / 127) * 0.7 + 0.3 : 1,
        boxShadow: step.on ? `0 0 6px ${color}40` : 'none',
      }}
      onClick={onToggle}
      title={step.on ? `V:${step.velocity} P:${step.pitch}` : undefined}
    />
  );
}

// ─── Channel Row ─────────────────────────────────────────────────────────────

export function ChannelRow({
  channel,
}: {
  channel: Channel;
}) {
  const {
    activePatternId, patterns, currentStep,
    toggleStep, setChannelMute, setChannelSolo, updateChannel,
  } = useChannelRackStore();

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(channel.name);

  const pattern = patterns.find((p) => p.id === activePatternId);
  const data = pattern?.channelData[channel.id];

  const commitName = useCallback(() => {
    setEditingName(false);
    if (nameVal.trim()) updateChannel(channel.id, { name: nameVal.trim() });
  }, [nameVal, channel.id, updateChannel]);

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 border-b group"
      style={{ borderColor: 'rgba(255,255,255,0.04)' }}
    >
      {/* Color dot */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
        style={{ background: channel.color }}
        onClick={() => {
          const idx = PALETTE.indexOf(channel.color);
          const next = PALETTE[(idx + 1) % PALETTE.length];
          updateChannel(channel.id, { color: next });
        }}
      />

      {/* M / S buttons */}
      <button
        className="w-5 h-5 text-[8px] font-bold rounded flex items-center justify-center flex-shrink-0 transition-colors"
        style={{
          background: channel.muted ? '#ff444440' : 'transparent',
          color: channel.muted ? '#ff4444' : 'var(--text-muted)',
          border: `1px solid ${channel.muted ? '#ff4444' : 'rgba(255,255,255,0.08)'}`,
        }}
        onClick={() => setChannelMute(channel.id, !channel.muted)}
        title="Mute"
      >
        M
      </button>
      <button
        className="w-5 h-5 text-[8px] font-bold rounded flex items-center justify-center flex-shrink-0 transition-colors"
        style={{
          background: channel.soloed ? '#ffbe0b40' : 'transparent',
          color: channel.soloed ? '#ffbe0b' : 'var(--text-muted)',
          border: `1px solid ${channel.soloed ? '#ffbe0b' : 'rgba(255,255,255,0.08)'}`,
        }}
        onClick={() => setChannelSolo(channel.id, !channel.soloed)}
        title="Solo"
      >
        S
      </button>

      {/* Name */}
      {editingName ? (
        <input
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') setEditingName(false);
          }}
          autoFocus
          className="w-20 text-[11px] font-rajdhani bg-transparent outline-none px-1 rounded flex-shrink-0"
          style={{ color: 'var(--text-primary)', border: '1px solid var(--accent-cyan)' }}
        />
      ) : (
        <span
          className="text-[11px] font-rajdhani font-semibold truncate flex-shrink-0 cursor-text"
          style={{ color: channel.muted ? 'var(--text-muted)' : 'var(--text-primary)', width: 72 }}
          onDoubleClick={() => { setEditingName(true); setNameVal(channel.name); }}
        >
          {channel.name}
        </span>
      )}

      {/* Steps / Piano roll preview */}
      <div className="flex items-center gap-px flex-1 min-w-0 overflow-x-auto hide-scrollbar">
        {channel.type === 'sample' && data ? (
          data.steps.map((step, i) => (
            <StepButton
              key={i}
              step={step}
              index={i}
              color={channel.color}
              isCurrent={currentStep === i}
              onToggle={() => toggleStep(channel.id, i)}
              groupOf4={Math.floor(i / 4)}
            />
          ))
        ) : (
          /* Instrument — mini piano roll preview */
          <div
            className="flex-1 h-5 rounded-sm flex items-center justify-center cursor-pointer hover:brightness-125"
            style={{
              background: `${channel.color}15`,
              border: `1px solid ${channel.color}30`,
            }}
          >
            <span className="text-[9px] font-rajdhani" style={{ color: channel.color }}>
              {data?.notes.length ?? 0} notes — Piano Roll
            </span>
          </div>
        )}
      </div>

      {/* Vol / Pan knobs */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
        <Knob
          value={channel.volume}
          onChange={(v) => updateChannel(channel.id, { volume: v })}
          size={24}
          color={channel.color}
          label=""
        />
        <Knob
          value={(channel.pan + 1) / 2}
          onChange={(v) => updateChannel(channel.id, { pan: v * 2 - 1 })}
          size={24}
          color="#ffbe0b"
          label=""
        />
      </div>
    </div>
  );
}
