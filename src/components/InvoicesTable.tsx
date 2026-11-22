import Link from 'next/link';
import type { Invoice } from '@/types/invoice';

export type InvoiceRow = Invoice & {
  clientName?: string | null;
  projectName?: string | null;
};

export interface InvoicesTableProps {
  invoices?: InvoiceRow[] | null;
  currency?: string;
  emptyMessage?: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Unpaid',
  partially_paid: 'Partly paid',
  paid: 'Paid',
  overdue: 'Overdue',
};

const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-secondary text-secondary-foreground',
  partially_paid: 'bg-primary/10 text-primary',
  paid: 'bg-accent/10 text-accent',
  overdue: 'bg-destructive/10 text-destructive',
};

function formatMoney(value: unknown, currency: string): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(Number.isFinite(n) ? n : 0);
}

export default function InvoicesTable({
  invoices,
  currency = 'USD',
  emptyMessage = 'No invoices yet. Create your first invoice to start billing clients.',
}: InvoicesTableProps) {
  const safeInvoices = Array.isArray(invoices) ? invoices : [];

  if (safeInvoices.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-[var(--radius)] border bg-card shadow-sm">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm" data-nexen-id="nx-7927b8ca-0">
        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-7927b8ca-1">
          <tr data-nexen-id="nx-7927b8ca-2">
            <th scope="col" className="px-4 py-3 font-semibold" data-nexen-id="nx-7927b8ca-3">Client</th>
            <th scope="col" className="px-4 py-3 font-semibold" data-nexen-id="nx-7927b8ca-4">Project</th>
            <th scope="col" className="px-4 py-3 font-semibold" data-nexen-id="nx-7927b8ca-5">Invoice</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold" data-nexen-id="nx-7927b8ca-6">Amount</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold" data-nexen-id="nx-7927b8ca-7">Paid</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold" data-nexen-id="nx-7927b8ca-8">Remaining</th>
            <th scope="col" className="px-4 py-3 font-semibold" data-nexen-id="nx-7927b8ca-9">Status</th>
          </tr>
        </thead>
        <tbody data-nexen-id="nx-7927b8ca-10">
          {safeInvoices.map((invoice) => {
            const status = String(invoice.status);
            const label = STATUS_LABELS[status] ?? status;
            const badgeClass = STATUS_CLASSES[status] ?? 'bg-muted text-muted-foreground';
            return (
              <tr data-nexen-component="nx_components_InvoicesTable"
                key={invoice.id}
                className="relative border-b transition-colors last:border-b-0 hover:bg-muted/50"
               data-nexen-id="nx-7927b8ca-11">
                <td className="min-w-0 px-4 py-3 align-middle text-foreground" data-nexen-id="nx-7927b8ca-12">
                  {invoice.clientName ?? '—'}
                </td>
                <td className="min-w-0 px-4 py-3 align-middle text-muted-foreground" data-nexen-id="nx-7927b8ca-13">
                  {invoice.projectName ?? '—'}
                </td>
                <td className="px-4 py-3 align-middle" data-nexen-id="nx-7927b8ca-14">
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="font-medium text-foreground after:absolute after:inset-0 after:content-['']"
                   data-nexen-id="nx-7927b8ca-15">
                    {invoice.invoiceNumber}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums" data-nexen-id="nx-7927b8ca-16">
                  {formatMoney(invoice.amount, currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums text-muted-foreground" data-nexen-id="nx-7927b8ca-17">
                  {formatMoney(invoice.amountPaid, currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right align-middle font-medium tabular-nums" data-nexen-id="nx-7927b8ca-18">
                  {formatMoney(invoice.balanceDue, currency)}
                </td>
                <td className="px-4 py-3 align-middle" data-nexen-id="nx-7927b8ca-19">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
                   data-nexen-id="nx-7927b8ca-20">
                    {label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}