import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
  accentLeft?: 'gold' | 'royal' | 'critical' | 'low' | 'filled' | null;
};

export function Card({ children, className = '', accentLeft = null }: CardProps) {
  const accentClass = accentLeft
    ? {
        gold: 'border-l-4 border-l-gold',
        royal: 'border-l-4 border-l-royal',
        critical: 'border-l-4 border-l-critical',
        low: 'border-l-4 border-l-low',
        filled: 'border-l-4 border-l-filled',
      }[accentLeft]
    : '';

  return (
    <div
      className={`bg-card rounded-xl border border-border-subtle ${accentClass} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  meta,
  eyebrow,
}: {
  title: ReactNode;
  meta?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5">
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-semibold tracking-wider uppercase text-ink-faint">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-[17px] font-semibold leading-snug">{title}</h2>
      </div>
      {meta ? (
        <div className="text-xs text-ink-muted shrink-0 whitespace-nowrap">{meta}</div>
      ) : null}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 pt-3 pb-5 ${className}`}>{children}</div>;
}
