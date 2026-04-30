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
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div>
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-semibold tracking-wider uppercase text-ink-faint">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-[17px] font-semibold leading-snug">{title}</h2>
      </div>
      {meta ? <div className="text-xs text-ink-muted">{meta}</div> : null}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 pt-3 pb-5 ${className}`}>{children}</div>;
}
