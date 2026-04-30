import { Card, CardBody, CardHeader } from './Card';

type Action = {
  label: string;
  sublabel: string;
  iconColor: 'royal' | 'gold';
  href?: string;
  disabled?: boolean;
};

const ACTIONS: Action[] = [
  { label: 'Snap receipt', sublabel: 'Updates inventory', iconColor: 'royal', disabled: true },
  { label: 'Square report', sublabel: 'After each game', iconColor: 'royal', disabled: true },
  { label: 'Master sheet', sublabel: 'Google Drive', iconColor: 'gold', disabled: true },
  { label: 'Volunteers', sublabel: 'All games', iconColor: 'gold', disabled: true },
  { label: 'Calendar', sublabel: 'Season schedule', iconColor: 'royal', disabled: true },
  { label: 'Print report', sublabel: 'Board meetings', iconColor: 'gold', disabled: true },
];

export function QuickActionsCard() {
  return (
    <Card>
      <CardHeader title="Quick actions" />
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ACTIONS.map((a) => (
            <div
              key={a.label}
              className={`flex items-center gap-3 rounded-xl border border-border-subtle bg-card px-3 py-3 ${
                a.disabled ? 'opacity-60' : 'hover:bg-white/5 transition-colors'
              }`}
            >
              <div
                className={`size-9 rounded-full ${
                  a.iconColor === 'royal' ? 'bg-royal' : 'bg-gold'
                } flex items-center justify-center shrink-0`}
              >
                <div className="size-4 rounded-sm bg-white/80"></div>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{a.label}</div>
                <div className="text-xs text-ink-muted truncate">{a.sublabel}</div>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
