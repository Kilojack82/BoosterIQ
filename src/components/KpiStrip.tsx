import { Card, CardBody } from './Card';

type Kpi = {
  label: string;
  value: string;
  sublabel: string;
  tone?: 'royal' | 'critical' | 'gold';
};

export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((kpi) => (
        <Card key={kpi.label}>
          <CardBody className="pt-5">
            <div className="text-xs text-ink-muted mb-2">{kpi.label}</div>
            <div
              className={`text-[28px] font-bold leading-none mb-2 ${
                kpi.tone === 'critical'
                  ? 'text-critical'
                  : kpi.tone === 'gold'
                    ? 'text-gold'
                    : 'text-skyblue'
              }`}
            >
              {kpi.value}
            </div>
            <div className="text-xs text-ink-muted">{kpi.sublabel}</div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
