'use client';

import { useState, type FormEvent } from 'react';
import type { Invoice } from '@/types/invoice';

export interface ScenarioInput {
  name: string;
  invoiceId: string;
  delayDays: number;
}

interface ScenarioFormProps {
  invoices: Invoice[];
  onSubmit: (input: ScenarioInput) => Promise<void> | void;
  isSubmitting?: boolean;
}

const fieldClass =
  'w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function ScenarioForm({
  invoices,
  onSubmit,
  isSubmitting = false,
}: ScenarioFormProps) {
  const safeInvoices = Array.isArray(invoices) ? invoices : [];

  const [name, setName] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [delayDays, setDelayDays] = useState('14');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const days = Number(delayDays);

    if (!invoiceId) {
      setFormError('Choose an invoice to delay.');
      return;
    }
    if (!Number.isInteger(days) || days <= 0) {
      setFormError('Delay must be a whole number of days greater than zero.');
      return;
    }

    try {
      await onSubmit({
        name: name.trim() || 'Delayed payment',
        invoiceId,
        delayDays: days,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the scenario.');
    }
  }

  return (
    <form data-nexen-component="nx_components_ScenarioForm"
      onSubmit={handleSubmit}
      className="w-full max-w-xl space-y-4 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm sm:p-6"
     data-nexen-id="nx-c78ad13c-0">
      <div className="space-y-1">
        <label htmlFor="scenario-name" className="block text-sm font-medium text-foreground" data-nexen-id="nx-c78ad13c-1">
          Scenario name
        </label>
        <input
          id="scenario-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Delayed payment"
          className={fieldClass}
         data-nexen-id="nx-c78ad13c-2"/>
      </div>

      <div className="space-y-1">
        <label htmlFor="scenario-invoice" className="block text-sm font-medium text-foreground" data-nexen-id="nx-c78ad13c-3">
          Invoice
        </label>
        <select
          id="scenario-invoice"
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
          className={fieldClass}
          required
         data-nexen-id="nx-c78ad13c-4">
          <option value="">Select an invoice</option>
          {safeInvoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {`${inv.invoiceNumber} · due ${String(inv.dueDate).slice(0, 10)}`}
            </option>
          ))}
        </select>
        {safeInvoices.length === 0 && (
          <p className="text-xs text-muted-foreground" data-nexen-id="nx-c78ad13c-5">No invoices available to simulate.</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="scenario-delay" className="block text-sm font-medium text-foreground" data-nexen-id="nx-c78ad13c-6">
          Delay (days)
        </label>
        <input
          id="scenario-delay"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={delayDays}
          onChange={(e) => setDelayDays(e.target.value)}
          className={fieldClass}
          required
         data-nexen-id="nx-c78ad13c-7"/>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-c78ad13c-8">
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="submit"
          disabled={isSubmitting || safeInvoices.length === 0}
          className="w-full rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
         data-nexen-id="nx-c78ad13c-9">
          {isSubmitting ? 'Saving…' : 'Create scenario'}
        </button>
      </div>
    </form>
  );
}