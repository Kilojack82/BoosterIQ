import type { Urgency } from '@/lib/urgency';
import { urgencyClasses } from '@/lib/urgency';

const LABELS: Record<Urgency, string> = {
  critical: 'Critical',
  low: 'Low',
  filled: 'Filled',
};

export function UrgencyTag({ urgency }: { urgency: Urgency }) {
  const c = urgencyClasses(urgency);
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${c.pillBg} ${c.pillText}`}
    >
      {LABELS[urgency]}
    </span>
  );
}
