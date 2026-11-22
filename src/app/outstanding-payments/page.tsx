
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  getAdminOutstandingPayments,
  getMyOutstandingPayments,
  createInvoiceReminder,
} from '@/lib/api';

interface OutstandingRow {
  invoice_id: string;
  invoice_number: string;
  client_id: string;
  client_name: string;
  balance_due: number;
  due_date: string;
  days_overdue: number;
  status: string;
  amount?: number;
  amount_paid?: number;
  project_name?: string | null;
}

const OWNER_ROLE = 'small_video_editing_business_owner';

function formatMoney(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-US');
}

export default function OutstandingPaymentsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const isOwner = user?.role === OWNER_ROLE;

  const [rows, setRows] = useState<OutstandingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data: OutstandingRow[] = isOwner
        ? await getAdminOutstandingPayments()
        : await getMyOutstandingPayments();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setError('Outstanding invoices could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      void load();
    }
  }, [loading, isAuthenticated, load]);

  async function startReminder(row: OutstandingRow) {
    setStartingId(row.invoice_id);
    setActionError(null);
    try {
      await createInvoiceReminder(row.invoice_id, { tone: 'friendly' });
      router.push('/payment-reminders');
    } catch {
      setActionError('Could not start a reminder for that invoice. Try again.');
    } finally {
      setStartingId(null);
    }
  }

  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 font-sans">
      <header className="min-w-0 space-y-1" data-nexen-id="nx-429bdcb7-0">
        <h1 className="text-2xl font-bold text-foreground" data-nexen-id="nx-429bdcb7-1">Outstanding Payments</h1>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-429bdcb7-2">
          Unpaid and overdue invoices, most late first.
        </p>
      </header>

      {actionError && (
        <p role="alert" className="text-sm text-[hsl(var(--destructive))]" data-nexen-id="nx-429bdcb7-3">
          {actionError}
        </p>
      )}

      <section className="rounded-[var(--radius)] border bg-card shadow-sm" data-nexen-id="nx-429bdcb7-4">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-429bdcb7-5">Loading outstanding invoices…</p>
        ) : error ? (
          <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[hsl(var(--destructive))]" data-nexen-id="nx-429bdcb7-6">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="h-9 rounded-[var(--radius)] border px-4 text-sm font-semibold text-foreground"
             data-nexen-id="nx-429bdcb7-7">
              Try again
            </button>
          </div>
        ) : safeRows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-429bdcb7-8">
            Nothing is outstanding right now. Every invoice is paid.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm" data-nexen-id="nx-429bdcb7-9">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-429bdcb7-10">
                <tr data-nexen-id="nx-429bdcb7-11">
                  <th className="px-4 py-3 font-medium" data-nexen-id="nx-429bdcb7-12">Client</th>
                  <th className="px-4 py-3 font-medium" data-nexen-id="nx-429bdcb7-13">Invoice</th>
                  <th className="px-4 py-3 font-medium" data-nexen-id="nx-429bdcb7-14">Project</th>
                  <th className="px-4 py-3 font-medium" data-nexen-id="nx-429bdcb7-15">Due date</th>
                  <th className="px-4 py-3 font-medium" data-nexen-id="nx-429bdcb7-16">Days overdue</th>
                  <th className="px-4 py-3 font-medium" data-nexen-id="nx-429bdcb7-17">Amount</th>
                  <th className="px-4 py-3 font-medium" data-nexen-id="nx-429bdcb7-18">Paid</th>
                  <th className="px-4 py-3 font-medium" data-nexen-id="nx-429bdcb7-19">Remaining</th>
                  <th className="px-4 py-3 font-medium" data-nexen-id="nx-429bdcb7-20">Status</th>
                  <th className="px-4 py-3 font-medium" data-nexen-id="nx-429bdcb7-21">Action</th>
                </tr>
              </thead>
              <tbody data-nexen-id="nx-429bdcb7-22">
                {safeRows.map((row) => {
                  const isOverdue = row.status === 'overdue' || row.days_overdue > 0;
                  return (
                    <tr data-nexen-component="nx_app_outstanding_payments_page" key={row.invoice_id} className="border-b last:border-0" data-nexen-id="nx-429bdcb7-23">
                      <td className="px-4 py-3 text-foreground" data-nexen-id="nx-429bdcb7-24">{row.client_name}</td>
                      <td className="px-4 py-3" data-nexen-id="nx-429bdcb7-25">
                        <Link
                          href={`/invoices/${row.invoice_id}`}
                          className="font-mono text-[hsl(var(--accent))] underline-offset-4 hover:underline"
                         data-nexen-id="nx-429bdcb7-26">
                          {row.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground" data-nexen-id="nx-429bdcb7-27">{row.project_name ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground" data-nexen-id="nx-429bdcb7-28">{formatDate(row.due_date)}</td>
                      <td className="px-4 py-3 text-foreground" data-nexen-id="nx-429bdcb7-29">
                        {row.days_overdue > 0 ? row.days_overdue : 'Not due yet'}
                      </td>
                      <td className="px-4 py-3 text-foreground" data-nexen-id="nx-429bdcb7-30">{formatMoney(row.amount)}</td>
                      <td className="px-4 py-3 text-foreground" data-nexen-id="nx-429bdcb7-31">{formatMoney(row.amount_paid)}</td>
                      <td className="px-4 py-3 font-semibold text-foreground" data-nexen-id="nx-429bdcb7-32">
                        {formatMoney(row.balance_due)}
                      </td>
                      <td className="px-4 py-3" data-nexen-id="nx-429bdcb7-33">
                        <span
                          className={
                            isOverdue
                              ? 'rounded-full bg-[hsl(var(--destructive))]/10 px-2 py-0.5 text-xs font-semibold text-[hsl(var(--destructive))]'
                              : 'rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground'
                          }
                         data-nexen-id="nx-429bdcb7-34">
                          {isOverdue ? 'Overdue' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="px-4 py-3" data-nexen-id="nx-429bdcb7-35">
                        {row.days_overdue > 0 ? (
                          <button
                            type="button"
                            onClick={() => void startReminder(row)}
                            disabled={startingId === row.invoice_id}
                            className="h-8 rounded-[var(--radius)] bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                           data-nexen-id="nx-429bdcb7-36">
                            {startingId === row.invoice_id ? 'Starting…' : 'Start reminder'}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground" data-nexen-id="nx-429bdcb7-37">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}