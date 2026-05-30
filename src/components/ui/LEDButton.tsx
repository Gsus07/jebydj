'use client';

import { motion } from 'framer-motion';

interface LEDButtonProps {
  active?: boolean;
  color?: string;
  onClick?: () => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

export function LEDButton({
  active = false,
  color = '#00f5ff',
  onClick,
  onMouseDown,
  onMouseUp,
  children,
  size = 'md',
  className = '',
  disabled = false,
}: LEDButtonProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-[10px]',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2 text-sm',
  };

  return (
    <motion.button
      whileTap={disabled ? {} : { scale: 0.92 }}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      disabled={disabled}
      className={`
        relative flex items-center justify-center gap-1 rounded
        font-rajdhani font-semibold uppercase tracking-wider
        border transition-all duration-150
        ${sizeClasses[size]}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${active
          ? 'border-current text-white'
          : 'border-[#2a2a3a] text-muted hover:border-current hover:text-[#888899]'
        }
        ${className}
      `}
      style={{
        color: active ? color : undefined,
        backgroundColor: active ? `${color}22` : '#1a1a24',
        boxShadow: active ? `0 0 12px ${color}66, inset 0 0 8px ${color}22` : 'none',
        borderColor: active ? color : undefined,
        minHeight: 36,
        minWidth: 36,
      }}
    >
      {/* LED indicator */}
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: active ? color : '#333344',
          boxShadow: active ? `0 0 6px ${color}` : 'none',
        }}
      />
      {children}
    </motion.button>
  );
}
