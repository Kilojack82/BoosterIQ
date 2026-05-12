type HeaderProps = {
  clubName: string;
  syncedLabel: string;
  contactEmail?: string;
};

export function Header({ clubName, syncedLabel, contactEmail }: HeaderProps) {
  return (
    <div className="bg-royal stadium-glow jersey-stripes rounded-xl px-5 py-5 flex items-center gap-4 overflow-hidden">
      <div className="size-14 rounded-full bg-navy ring-2 ring-gold flex items-center justify-center shrink-0">
        <span className="text-gold font-display text-lg leading-none">LV</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-gold">
          Booster IQ
        </div>
        <h1 className="font-display text-[40px] uppercase tracking-wide text-white leading-none truncate">
          {clubName}
        </h1>
        <div className="text-xs text-white/75 mt-1">
          {syncedLabel}
          {contactEmail ? <> · {contactEmail}</> : null}
        </div>
      </div>
    </div>
  );
}
