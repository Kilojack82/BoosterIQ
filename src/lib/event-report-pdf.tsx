/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { EventReportData } from './event-report-data';
import { formatCents, formatDate } from './format';

const ROYAL = '#1f4d9e';
const NAVY = '#0f2c66';
const GOLD = '#f5c518';
const INK = '#0a0a0a';
const MUTED = '#555';
const FAINT = '#888';
const RULE = '#d8d8d8';

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingHorizontal: 36,
    paddingBottom: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: INK,
  },
  header: {
    backgroundColor: ROYAL,
    color: '#ffffff',
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  shield: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NAVY,
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldText: {
    color: GOLD,
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
  },
  eyebrow: {
    color: GOLD,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    lineHeight: 1.15,
  },
  subtitle: {
    color: '#e6e6e6',
    fontSize: 9,
    marginTop: 2,
  },
  generatedBox: {
    alignItems: 'flex-end',
  },
  generatedLabel: {
    color: '#cfd8e8',
    fontSize: 7,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  generatedValue: {
    color: '#ffffff',
    fontSize: 9,
  },
  glanceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  glance: {
    flex: 1,
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  glanceLabel: {
    fontSize: 7,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: MUTED,
  },
  glanceValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    marginTop: 3,
  },
  glanceValueGold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    marginTop: 3,
    color: '#a18512',
  },
  glanceSub: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
  },
  sectionWrapper: {
    marginTop: 14,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    color: '#a18512',
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionBody: {
    borderLeftWidth: 2,
    borderLeftColor: ROYAL,
    paddingLeft: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  summaryRowEmphasis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: ROYAL,
    marginTop: 4,
  },
  summaryLabel: { color: MUTED, fontSize: 9 },
  summaryLabelEmphasis: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryValue: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  summaryValueEmphasis: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: '#a18512',
  },
  itemsHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: ROYAL,
  },
  itemsHeaderCellName: {
    flex: 1,
    fontSize: 7,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: FAINT,
    fontFamily: 'Helvetica-Bold',
  },
  itemsHeaderCellQty: {
    width: 38,
    textAlign: 'right',
    fontSize: 7,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: FAINT,
    fontFamily: 'Helvetica-Bold',
  },
  itemsHeaderCellSales: {
    width: 60,
    textAlign: 'right',
    fontSize: 7,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: FAINT,
    fontFamily: 'Helvetica-Bold',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderLeftWidth: 2,
    marginVertical: 1,
    borderRadius: 4,
  },
  itemRowTop: {
    backgroundColor: '#eaf1fb',
    borderLeftColor: ROYAL,
  },
  itemRowMid: {
    backgroundColor: '#fdf6db',
    borderLeftColor: GOLD,
  },
  itemRowRest: {
    backgroundColor: '#f9f7ed',
    borderLeftColor: '#e0d6a8',
  },
  itemName: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  itemCategory: {
    fontSize: 7,
    color: MUTED,
    marginTop: 1,
  },
  itemQty: {
    width: 38,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  itemSales: {
    width: 60,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  totalsRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 1.5,
    borderTopColor: ROYAL,
  },
  table: { marginTop: 4 },
  tableHead: {
    flexDirection: 'row',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  tableHeadCell: {
    fontSize: 7,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: FAINT,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  cellRole: { width: 110, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  cellFilled: { width: 50, fontSize: 9 },
  cellNames: { flex: 1, fontSize: 9, color: MUTED },
  cellDate: { width: 70, fontSize: 9 },
  cellVendor: { flex: 1, fontSize: 9 },
  cellAmount: { width: 70, textAlign: 'right', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  emptyCopy: { fontSize: 9, color: MUTED, fontStyle: 'italic' },
  footer: {
    marginTop: 18,
    paddingTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: ROYAL,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: MUTED,
  },
  footerWordmark: {
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: ROYAL,
  },
});

function tierStyle(index: number) {
  if (index < 5) return styles.itemRowTop;
  if (index < 10) return styles.itemRowMid;
  return styles.itemRowRest;
}

export function EventReportPdfDocument({ data }: { data: EventReportData }) {
  const homeAway =
    data.event.is_home == null ? '' : data.event.is_home ? ' · Home' : ' · Away';
  const opponent = data.event.opponent ? ` vs. ${data.event.opponent}` : '';
  const generated = new Date(data.generated_at).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const summary = data.sales?.summary ?? null;
  const hasPaymentBreakdown =
    summary != null &&
    [
      summary.cash_cents,
      summary.card_cents,
      summary.cashapp_cents,
      summary.fees_cents,
      summary.net_total_cents,
    ].some((v) => v != null);

  return (
    <Document
      title={`Post-game report — ${data.event.name}`}
      author="Booster IQ"
      subject="Lago Vista Vikings Booster Club"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.shield}>
            <Text style={styles.shieldText}>LV</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Booster IQ · Post-game Report</Text>
            <Text style={styles.title}>
              {data.event.name}
              {opponent}
              {homeAway}
            </Text>
            <Text style={styles.subtitle}>
              {formatDate(data.event.date)}
              {data.event.attendance_actual
                ? ` · ${data.event.attendance_actual} attendance`
                : ''}
              {data.event.weather ? ` · ${data.event.weather}` : ''}
            </Text>
          </View>
          <View style={styles.generatedBox}>
            <Text style={styles.generatedLabel}>Generated</Text>
            <Text style={styles.generatedValue}>{generated}</Text>
          </View>
        </View>

        <View style={styles.glanceRow}>
          <View style={styles.glance}>
            <Text style={styles.glanceLabel}>Game day sales</Text>
            <Text style={styles.glanceValue}>
              {data.sales ? data.sales.total_qty : '—'}
            </Text>
            <Text style={styles.glanceSub}>
              {data.sales
                ? `${formatCents(data.sales.total_net_sales_cents)} net`
                : 'No sales uploaded'}
            </Text>
          </View>
          <View style={styles.glance}>
            <Text style={styles.glanceLabel}>Gross sales</Text>
            <Text style={styles.glanceValue}>
              {data.sales ? formatCents(data.sales.total_gross_sales_cents) : '—'}
            </Text>
            <Text style={styles.glanceSub}>
              {data.sales
                ? data.sales.total_qty === 0
                  ? '0 transactions'
                  : `${data.sales.total_qty} transactions`
                : 'No sales uploaded'}
            </Text>
          </View>
          <View style={styles.glance}>
            <Text style={styles.glanceLabel}>Take-home</Text>
            <Text style={styles.glanceValueGold}>
              {summary?.net_total_cents != null
                ? formatCents(summary.net_total_cents)
                : data.sales
                  ? formatCents(data.sales.total_net_sales_cents)
                  : '—'}
            </Text>
            <Text style={styles.glanceSub}>
              {summary?.net_total_cents != null ? 'Net after fees' : 'Net sales'}
            </Text>
          </View>
        </View>

        {hasPaymentBreakdown && summary ? (
          <View style={styles.sectionWrapper} wrap={false}>
            <Text style={styles.sectionTitle}>Sales Summary</Text>
            <View style={styles.sectionBody}>
              {summary.cash_cents != null ? (
                <SummaryLine label="Cash" value={summary.cash_cents} />
              ) : null}
              {summary.card_cents != null ? (
                <SummaryLine label="Card" value={summary.card_cents} />
              ) : null}
              {summary.cashapp_cents != null ? (
                <SummaryLine label="Cash App" value={summary.cashapp_cents} />
              ) : null}
              {summary.giftcard_cents != null && summary.giftcard_cents !== 0 ? (
                <SummaryLine label="Gift card" value={summary.giftcard_cents} />
              ) : null}
              {summary.other_cents != null && summary.other_cents !== 0 ? (
                <SummaryLine label="Other" value={summary.other_cents} />
              ) : null}
              {summary.fees_cents != null ? (
                <SummaryLine label="Fees" value={summary.fees_cents} />
              ) : null}
              {summary.net_total_cents != null ? (
                <SummaryLine
                  label="Net total"
                  value={summary.net_total_cents}
                  emphasize
                />
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>Game Day Sales</Text>
          <View style={styles.sectionBody}>
            {data.items_sold.length > 0 ? (
              <>
                <View style={styles.itemsHeader}>
                  <Text style={styles.itemsHeaderCellName}>Item</Text>
                  <Text style={styles.itemsHeaderCellQty}>Qty</Text>
                  <Text style={styles.itemsHeaderCellSales}>Sales</Text>
                </View>
                {data.items_sold.map((row, i) => (
                  <View
                    key={row.id}
                    style={[styles.itemRow, tierStyle(i)]}
                    wrap={false}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{row.name}</Text>
                      {row.category ? (
                        <Text style={styles.itemCategory}>{row.category}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.itemQty}>{row.sold_qty}</Text>
                    <Text style={styles.itemSales}>
                      {row.net_sales_cents > 0
                        ? formatCents(row.net_sales_cents)
                        : '—'}
                    </Text>
                  </View>
                ))}
                <View style={styles.totalsRow}>
                  <Text style={[styles.itemName, { letterSpacing: 1, textTransform: 'uppercase', fontSize: 8 }]}>
                    Total
                  </Text>
                  <Text style={styles.itemQty}>{data.sales?.total_qty ?? 0}</Text>
                  <Text style={styles.itemSales}>
                    {formatCents(data.sales?.total_net_sales_cents ?? 0)}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.emptyCopy}>
                No items recorded from Square for this event.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>Volunteer Roster</Text>
          <View style={styles.sectionBody}>
            {data.volunteers.total > 0 ? (
              <View style={styles.table}>
                <View style={styles.tableHead}>
                  <Text style={[styles.tableHeadCell, { width: 110 }]}>Role</Text>
                  <Text style={[styles.tableHeadCell, { width: 50 }]}>Filled</Text>
                  <Text style={[styles.tableHeadCell, { flex: 1 }]}>Volunteers</Text>
                </View>
                {data.volunteers.by_role.map((r) => (
                  <View key={r.role} style={styles.tableRow} wrap={false}>
                    <Text style={styles.cellRole}>{r.role}</Text>
                    <Text style={styles.cellFilled}>
                      {r.filled} / {r.total}
                    </Text>
                    <Text style={styles.cellNames}>
                      {r.names.length > 0 ? r.names.join(', ') : '—'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyCopy}>
                No volunteer slots synced for this event.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>Supply Spending — Past 7 Days</Text>
          <View style={styles.sectionBody}>
            {data.receipts.length > 0 ? (
              <View style={styles.table}>
                <View style={styles.tableHead}>
                  <Text style={[styles.tableHeadCell, { width: 70 }]}>Date</Text>
                  <Text style={[styles.tableHeadCell, { flex: 1 }]}>Vendor</Text>
                  <Text
                    style={[
                      styles.tableHeadCell,
                      { width: 70, textAlign: 'right' },
                    ]}
                  >
                    Total
                  </Text>
                </View>
                {data.receipts.map((r) => (
                  <View key={r.id} style={styles.tableRow} wrap={false}>
                    <Text style={styles.cellDate}>{r.receipt_date ?? '—'}</Text>
                    <Text style={styles.cellVendor}>{r.vendor ?? '—'}</Text>
                    <Text style={styles.cellAmount}>
                      {formatCents(r.total_cents)}
                    </Text>
                  </View>
                ))}
                <View style={styles.totalsRow}>
                  <Text
                    style={[
                      styles.cellDate,
                      { fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', fontSize: 8, letterSpacing: 1 },
                    ]}
                  >
                    Total
                  </Text>
                  <Text style={styles.cellVendor}> </Text>
                  <Text style={styles.cellAmount}>
                    {formatCents(data.receipts_total_cents)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyCopy}>
                No receipts logged in the 7 days before this event.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerWordmark}>Booster IQ</Text>
          <Text>Lago Vista Vikings Booster Club</Text>
          <Text>Generated {generated}</Text>
        </View>
      </Page>
    </Document>
  );
}

function SummaryLine({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <View style={emphasize ? styles.summaryRowEmphasis : styles.summaryRow}>
      <Text style={emphasize ? styles.summaryLabelEmphasis : styles.summaryLabel}>
        {label}
      </Text>
      <Text style={emphasize ? styles.summaryValueEmphasis : styles.summaryValue}>
        {formatCents(value)}
      </Text>
    </View>
  );
}
