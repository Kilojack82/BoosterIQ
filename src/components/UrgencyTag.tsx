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
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${c.pillBg} ${c.pillText}`}
    >
      {LABELS[urgency]}
    </span>
  );
}
