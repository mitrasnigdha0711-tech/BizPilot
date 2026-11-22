
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import InvoiceLineItemsTable from '@/components/InvoiceLineItemsTable';
import PaymentsTable from '@/components/PaymentsTable';
import RecordPaymentForm from '@/components/RecordPaymentForm';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  getMyInvoiceById,
  getAdminInvoiceById,
  getInvoiceLineItems,
  getInvoicePayments,
  createMyInvoiceSend,
  createAdminInvoiceSend,
  createMyInvoiceLineItem,
  updateMyInvoiceLineItem,
  deleteMyInvoiceLineItem,
  createAdminInvoiceLineItem,
  updateAdminInvoiceLineItem,
  deleteAdminInvoiceLineItem,
  createPaymentReceive,
  updatePayment,
} from '@/lib/api';

type InvoiceDetail = Awaited<ReturnType<typeof getMyInvoiceById>>;
type LineItem = Awaited<ReturnType<typeof getInvoiceLineItems>>[number];
type PaymentRow = Awaited<ReturnType<typeof getInvoicePayments>>[number];
type LineItemDraft = Parameters<typeof InvoiceLineItemsTable>[0]['items'][number];

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoiceId = params.id;
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isOwner, business } = useCurrentUser();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');

  const currency = business?.currency ?? 'USD';
  const money = (n: unknown) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [inv, lines, pays] = await Promise.all([
        isOwner ? getAdminInvoiceById(invoiceId) : getMyInvoiceById(invoiceId),
        getInvoiceLineItems(invoiceId),
        getInvoicePayments(invoiceId),
      ]);
      setInvoice(inv);
      setLineItems(lines);
      setPayments(pays);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId, isOwner]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    void loadAll();
  }, [authLoading, isAuthenticated, loadAll, router]);

  const lineApi = isOwner
    ? {
        create: createAdminInvoiceLineItem,
        update: updateAdminInvoiceLineItem,
        remove: deleteAdminInvoiceLineItem,
      }
    : {
        create: createMyInvoiceLineItem,
        update: updateMyInvoiceLineItem,
        remove: deleteMyInvoiceLineItem,
      };
  const sendFn = isOwner ? createAdminInvoiceSend : createMyInvoiceSend;
  const canEdit = invoice?.status === 'draft';
  const canRecord = invoice?.status === 'sent' || invoice?.status === 'partially_paid';

  const drafts: LineItemDraft[] = lineItems.map((l) => ({
    id: l.id,
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
  }));

  async function syncLineItems(next: LineItemDraft[]) {
    setActionError(null);
    try {
      const nextIds = new Set(next.map((i) => i.id).filter(Boolean));
      for (const old of lineItems) {
        if (!nextIds.has(old.id)) await lineApi.remove(invoiceId, old.id);
      }
      for (const draft of next) {
        const input = {
          description: draft.description,
          quantity: Number(draft.quantity),
          unitPrice: Number(draft.unitPrice),
        };
        if (!draft.id) {
          await lineApi.create(invoiceId, input as LineItem);
        } else {
          const old = lineItems.find((l) => l.id === draft.id);
          if (
            old &&
            (old.description !== input.description ||
              Number(old.quantity) !== input.quantity ||
              Number(old.unitPrice) !== input.unitPrice)
          ) {
            await lineApi.update(invoiceId, draft.id, input);
          }
        }
      }
      await loadAll();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  async function sendInvoice() {
    setIsSending(true);
    setActionError(null);
    try {
      await sendFn(invoiceId, {});
      await loadAll();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setIsSending(false);
    }
  }

  async function markReceived(paymentId: string) {
    setActionError(null);
    try {
      await createPaymentReceive(paymentId, {});
      await loadAll();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  async function saveEdit(paymentId: string) {
    setActionError(null);
    try {
      await updatePayment(paymentId, { amount: Number(editAmount), expectedDate: editDate });
      setEditingId(null);
      await loadAll();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  if (authLoading || (isAuthenticated && isLoading)) {
    return <p className="p-6 text-sm text-[hsl(var(--muted-foreground))]" data-nexen-id="nx-4eca7f76-0">Loading…</p>;
  }
  if (!isAuthenticated) return null;
  if (error) {
    return <p className="p-6 text-sm text-[hsl(var(--destructive))]" data-nexen-id="nx-4eca7f76-1">{error}</p>;
  }
  if (!invoice) return null;

  const expectedPayments = payments.filter((p) => p.status === 'expected');

  return (
    <main data-nexen-component="nx_app_invoices__id__page" className="mx-auto w-full max-w-5xl min-w-0 space-y-6 p-4 sm:p-6" data-nexen-id="nx-4eca7f76-2">
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-nexen-id="nx-4eca7f76-3">
        <div className="min-w-0">
          <Link href="/invoices" className="text-sm text-[hsl(var(--muted-foreground))] hover:underline" data-nexen-id="nx-4eca7f76-4">
            ← Invoices
          </Link>
          <h1 className="break-words text-2xl font-semibold" data-nexen-id="nx-4eca7f76-5">Invoice {invoice.invoiceNumber}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]" data-nexen-id="nx-4eca7f76-6">Due {invoice.dueDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border px-3 py-1 text-xs font-semibold" data-nexen-id="nx-4eca7f76-7">{invoice.status}</span>
          {invoice.status === 'draft' && (
            <button
              type="button"
              onClick={() => void sendInvoice()}
              disabled={isSending}
              className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
             data-nexen-id="nx-4eca7f76-8">
              {isSending ? 'Sending…' : 'Send invoice'}
            </button>
          )}
        </div>
      </header>

      {actionError && (
        <p className="text-sm text-[hsl(var(--destructive))]" data-nexen-id="nx-4eca7f76-9">{actionError}</p>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-nexen-id="nx-4eca7f76-10">
        <div className="rounded-[var(--radius)] border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]" data-nexen-id="nx-4eca7f76-11">Total</p>
          <p className="text-xl font-semibold" data-nexen-id="nx-4eca7f76-12">{money(invoice.amount)}</p>
        </div>
        <div className="rounded-[var(--radius)] border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]" data-nexen-id="nx-4eca7f76-13">Paid so far</p>
          <p className="text-xl font-semibold" data-nexen-id="nx-4eca7f76-14">{money(invoice.amountPaid)}</p>
        </div>
        <div className="rounded-[var(--radius)] border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]" data-nexen-id="nx-4eca7f76-15">Remaining</p>
          <p className="text-xl font-semibold" data-nexen-id="nx-4eca7f76-16">{money(invoice.balanceDue)}</p>
        </div>
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-4eca7f76-17">
        <h2 className="mb-2 text-lg font-semibold" data-nexen-id="nx-4eca7f76-18">Line items</h2>
        {!canEdit && (
          <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]" data-nexen-id="nx-4eca7f76-19">
            Line items are locked once the invoice is sent.
          </p>
        )}
        <div className="overflow-x-auto">
          <InvoiceLineItemsTable
            items={drafts}
            onChange={canEdit ? (next) => void syncLineItems(next) : () => {}}
            currency={currency}
          />
        </div>
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-4eca7f76-20">
        <h2 className="mb-2 text-lg font-semibold" data-nexen-id="nx-4eca7f76-21">Payments</h2>
        <div className="overflow-x-auto">
          <PaymentsTable payments={payments} currency={currency} />
        </div>

        {expectedPayments.length > 0 && (
          <ul className="mt-4 grid gap-3" data-nexen-id="nx-4eca7f76-22">
            {expectedPayments.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 rounded-[var(--radius)] border p-3 sm:flex-row sm:items-center sm:justify-between" data-nexen-id="nx-4eca7f76-23">
                {editingId === p.id ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full rounded-[var(--radius)] border bg-background px-3 py-2 text-sm sm:w-40"
                      aria-label="Amount"
                     data-nexen-id="nx-4eca7f76-24"/>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full rounded-[var(--radius)] border bg-background px-3 py-2 text-sm sm:w-44"
                      aria-label="Expected date"
                     data-nexen-id="nx-4eca7f76-25"/>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void saveEdit(p.id)} className="rounded-[var(--radius)] bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" data-nexen-id="nx-4eca7f76-26">
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-[var(--radius)] border px-3 py-2 text-sm" data-nexen-id="nx-4eca7f76-27">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="min-w-0 text-sm" data-nexen-id="nx-4eca7f76-28">
                      {money(p.amount)} expected {p.expectedDate ? `by ${String(p.expectedDate).slice(0, 10)}` : ''}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(p.id);
                          setEditAmount(String(Number(p.amount)));
                          setEditDate(p.expectedDate ? String(p.expectedDate).slice(0, 10) : '');
                        }}
                        className="rounded-[var(--radius)] border px-3 py-2 text-sm"
                       data-nexen-id="nx-4eca7f76-29">
                        Edit
                      </button>
                      <button type="button" onClick={() => void markReceived(p.id)} className="rounded-[var(--radius)] bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" data-nexen-id="nx-4eca7f76-30">
                        Mark received
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canRecord && (
        <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-4eca7f76-31">
          <RecordPaymentForm
            invoiceId={invoiceId}
            balanceDue={Number(invoice.balanceDue)}
            onRecorded={() => void loadAll()}
          />
        </section>
      )}
    </main>
  );
}