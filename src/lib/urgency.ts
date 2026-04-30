export type Urgency = 'critical' | 'low' | 'filled';

export type UrgencyClasses = {
  pillBg: string;
  pillText: string;
  rowBg: string;
  rowBorder: string;
  text: string;
};

export function urgencyClasses(u: Urgency): UrgencyClasses {
  switch (u) {
    case 'critical':
      return {
        pillBg: 'bg-critical',
        pillText: 'text-white',
        rowBg: 'bg-critical/8',
        rowBorder: 'border-critical',
        text: 'text-critical',
      };
    case 'low':
      return {
        pillBg: 'bg-low',
        pillText: 'text-navy',
        rowBg: 'bg-low/6',
        rowBorder: 'border-low',
        text: 'text-low',
      };
    case 'filled':
      return {
        pillBg: 'bg-filled',
        pillText: 'text-white',
        rowBg: 'bg-filled/6',
        rowBorder: 'border-filled',
        text: 'text-filled',
      };
  }
}

/**
 * Compute urgency for a stocked item given its current stock vs par level
 * and the per-club par-buffer thresholds (in "games of runway" — i.e.
 * fraction of par_level remaining).
 *
 * For V1 step 6 we don't yet know consumption rate per game, so the
 * "runway" approximation is just current_stock / par_level. When we
 * have post-game depletion data (after step 5 lands), this becomes
 * properly forecasted runway.
 */
export function shoppingListUrgency(args: {
  current_stock: number;
  par_level: number;
  critical_buffer: number;
  low_buffer: number;
}): Urgency | null {
  const { current_stock, par_level, critical_buffer, low_buffer } = args;
  if (par_level <= 0) return null;
  const runway = current_stock / par_level;
  if (runway <= critical_buffer) return 'critical';
  if (runway <= low_buffer) return 'low';
  return null;
}
