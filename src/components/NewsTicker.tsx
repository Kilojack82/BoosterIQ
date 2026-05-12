type NewsTickerProps = {
  items: string[];
};

export function NewsTicker({ items }: NewsTickerProps) {
  if (items.length === 0) return null;
  const text = items.join(' · ');

  return (
    <div className="bg-surface border-b border-border-subtle flex items-center gap-3 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest">
      <span className="bg-live text-white px-1.5 py-0.5 rounded-sm shrink-0 inline-flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-white" aria-hidden />
        LIVE
      </span>
      <div className="overflow-hidden flex-1">
        <div className="news-ticker-track whitespace-nowrap text-ink-muted">
          {text}
        </div>
      </div>
    </div>
  );
}
