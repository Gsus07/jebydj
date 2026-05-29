'use client';

interface DisplayNumberProps {
  value: string | number;
  label?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  unit?: string;
  className?: string;
}

const sizeCls = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-4xl',
};

export function DisplayNumber({
  value,
  label,
  color = '#00f5ff',
  size = 'md',
  unit,
  className = '',
}: DisplayNumberProps) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {label && (
        <span className="text-[9px] font-rajdhani text-muted uppercase tracking-widest mb-0.5">
          {label}
        </span>
      )}
      <div
        className={`font-orbitron font-bold tabular-nums ${sizeCls[size]}`}
        style={{
          color,
          textShadow: `0 0 10px ${color}88, 0 0 20px ${color}44`,
        }}
      >
        {value}
        {unit && (
          <span className="text-[0.6em] ml-0.5 opacity-70">{unit}</span>
        )}
      </div>
    </div>
  );
}
