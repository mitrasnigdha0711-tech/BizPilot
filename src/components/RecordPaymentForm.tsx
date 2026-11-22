
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createInvoicePayment } from '@/lib/api';

interface RecordPaymentFormProps {
  invoiceId: string;
  balanceDue: number;
  onRecorded?: () => void;
}

const inputClass =
  'h-10 w-full min-w-0 rounded-[var(--radius)] border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function RecordPaymentForm({ invoiceId, balanceDue, onRecorded }: RecordPaymentFormProps) {
  const balance = Number.isFinite(balanceDue) ? balanceDue : 0;
  const [amount, setAmount] = useState('');
  const [receivedAt, setReceivedAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Computed on the client after mount so server and client markup match.
  useEffect(() => {
    setReceivedAt(new Date().toLocaleDateString('en-CA'));
  }, []);

  function validate(): string | null {
    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      return 'Enter an amount greater than zero.';
    }
    if (value > balance) {
      return `Amount cannot be more than the balance due ($${balance.toFixed(2)}).`;
    }
    if (!receivedAt) {
      return 'Choose the date the payment was received.';
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await createInvoicePayment(invoiceId, { amount: Number(amount), receivedAt });
      setAmount('');
      onRecorded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record this payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (balance <= 0) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-card p-4 text-sm text-muted-foreground">
        This invoice has no balance due, so there is nothing to record.
      </div>
    );
  }

  return (
    <form data-nexen-component="nx_components_RecordPaymentForm"
      onSubmit={handleSubmit}
      noValidate
      className="w-full min-w-0 space-y-4 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm"
     data-nexen-id="nx-1e8fd553-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground" data-nexen-id="nx-1e8fd553-1">Record a payment</h3>
        <span className="text-sm text-muted-foreground" data-nexen-id="nx-1e8fd553-2">
          Balance due: <span className="font-medium text-foreground" data-nexen-id="nx-1e8fd553-3">${balance.toFixed(2)}</span>
        </span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted-foreground" data-nexen-id="nx-1e8fd553-4">
          Amount
          <div className="flex min-w-0 gap-2">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              max={balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputClass}
             data-nexen-id="nx-1e8fd553-5"/>
            <button
              type="button"
              onClick={() => setAmount(balance.toFixed(2))}
              className="h-10 shrink-0 rounded-[var(--radius)] border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
             data-nexen-id="nx-1e8fd553-6">
              Full balance
            </button>
          </div>
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted-foreground" data-nexen-id="nx-1e8fd553-7">
          Date received
          <input
            type="date"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            className={inputClass}
           data-nexen-id="nx-1e8fd553-8"/>
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[color:var(--destructive)]" data-nexen-id="nx-1e8fd553-9">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius)] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-60 sm:w-auto"
         data-nexen-id="nx-1e8fd553-10">
          {isSubmitting ? 'Recording…' : 'Record payment'}
        </button>
      </div>
    </form>
  );
}