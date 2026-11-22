import type { Payment } from '@/types/payment';

type PaymentsTableProps = {
  payments?: Payment[] | null;
  currency?: string;
};

function formatDay(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && value.length >= 10) return value.slice(0, 10);
  return '—';
}

function formatAmount(value: unknown, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

export default function PaymentsTable({ payments, currency = 'USD' }: PaymentsTableProps) {
  const safePayments = Array.isArray(payments) ? payments : [];

  if (safePayments.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
        No payments recorded yet.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-[var(--radius)] border border-border bg-card shadow-sm">
      <table className="w-full min-w-[32rem] text-left text-sm" data-nexen-id="nx-a12d148c-0">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground" data-nexen-id="nx-a12d148c-1">
          <tr data-nexen-id="nx-a12d148c-2">
            <th scope="col" className="px-4 py-3 font-semibold" data-nexen-id="nx-a12d148c-3">Amount</th>
            <th scope="col" className="px-4 py-3 font-semibold" data-nexen-id="nx-a12d148c-4">Status</th>
            <th scope="col" className="px-4 py-3 font-semibold" data-nexen-id="nx-a12d148c-5">Expected</th>
            <th scope="col" className="px-4 py-3 font-semibold" data-nexen-id="nx-a12d148c-6">Received</th>
          </tr>
        </thead>
        <tbody data-nexen-id="nx-a12d148c-7">
          {safePayments.map((payment) => {
            const status = String(payment.status);
            const isReceived = status === 'received';
            return (
              <tr data-nexen-component="nx_components_PaymentsTable" key={payment.id} className="border-t border-border text-foreground" data-nexen-id="nx-a12d148c-8">
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums" data-nexen-id="nx-a12d148c-9">
                  {formatAmount(payment.amount, currency)}
                </td>
                <td className="px-4 py-3" data-nexen-id="nx-a12d148c-10">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      isReceived ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}
                   data-nexen-id="nx-a12d148c-11">
                    {isReceived ? 'Received' : 'Expected'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground" data-nexen-id="nx-a12d148c-12">
                  {formatDay(payment.expectedDate)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground" data-nexen-id="nx-a12d148c-13">
                  {formatDay(payment.receivedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}