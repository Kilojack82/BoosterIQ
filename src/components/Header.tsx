type HeaderProps = {
  clubName: string;
  syncedLabel: string;
  contactEmail?: string;
};

export function Header({ clubName, syncedLabel, contactEmail }: HeaderProps) {
  return (
    <div className="bg-royal rounded-xl px-5 py-5 flex items-center gap-4">
      <div className="size-14 rounded-full bg-navy ring-2 ring-gold flex items-center justify-center shrink-0">
        <span className="text-gold font-bold text-base tracking-tight">LV</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-gold">
          Booster IQ · V1
        </div>
        <h1 className="text-[22px] font-semibold text-white leading-tight truncate">
          {clubName}
        </h1>
        <div className="text-xs text-white/75">
          {syncedLabel}
          {contactEmail ? <> · {contactEmail}</> : null}
        </div>
      </div>
    </div>
  );
}
