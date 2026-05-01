import Link from 'next/link';
import { Card, CardBody, CardHeader } from './Card';

type Action = {
  label: string;
  sublabel: string;
  iconColor: 'royal' | 'gold';
  href?: string;
  disabled?: boolean;
};

function ActionTile({ a }: { a: Action }) {
  const inner = (
    <>
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
    </>
  );
  const className = `flex items-center gap-3 rounded-xl border border-border-subtle bg-card px-3 py-3 ${
    a.disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/5 transition-colors'
  }`;
  if (a.href && !a.disabled) {
    return (
      <Link href={a.href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function QuickActionsCard({
  latestEventId,
}: {
  latestEventId: string | null;
}) {
  const actions: Action[] = [
    {
      label: 'Snap receipt',
      sublabel: 'Updates inventory',
      iconColor: 'royal',
      href: '/receipts/upload',
    },
    {
      label: 'Square report',
      sublabel: 'After each game',
      iconColor: 'royal',
      href: '/square/upload',
    },
    { label: 'Master sheet', sublabel: 'Google Drive', iconColor: 'gold', disabled: true },
    {
      label: 'Add event',
      sublabel: 'Game + roster URL',
      iconColor: 'gold',
      href: '/events/new',
    },
    { label: 'Calendar', sublabel: 'Season schedule', iconColor: 'royal', disabled: true },
    latestEventId
      ? {
          label: 'Print report',
          sublabel: 'Last game recap',
          iconColor: 'gold',
          href: `/events/${latestEventId}/report`,
        }
      : {
          label: 'Print report',
          sublabel: 'No games yet',
          iconColor: 'gold',
          disabled: true,
        },
  ];

  return (
    <Card>
      <CardHeader title="Quick actions" />
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {actions.map((a) => (
            <ActionTile key={a.label} a={a} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
