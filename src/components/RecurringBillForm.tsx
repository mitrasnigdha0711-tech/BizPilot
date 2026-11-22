'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRecurringBill, ApiError } from '@/lib/api';

type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

type FormState = {
  name: string;
  amount: string;
  frequency: '' | Frequency;
  startDate: string;
  endDate: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const INITIAL: FormState = { name: '', amount: '', frequency: '', startDate: '', endDate: '' };
const MAX_AMOUNT = 1000000;
const RECURRING_BILLS_PATH = '/recurring-bills';

const inputClass =
  'w-full min-w-0 h-10 rounded-[var(--radius)] border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const labelClass = 'mb-1 block text-sm font-medium text-foreground';
const errorClass = 'mt-1 text-xs text-destructive';

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {};
  const name = values.name.trim();
  if (!name) {
    errors.name = 'Please enter a name for this bill.';
  } else if (name.length > 100) {
    errors.name = 'Bill name must be 100 characters or fewer.';
  }

  const amount = Number(values.amount);
  if (!values.amount.trim() || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    errors.amount = 'Enter an amount between 0.01 and 1,000,000.';
  }

  if (!values.frequency) {
    errors.frequency = 'Choose how often this bill repeats.';
  }

  if (!values.startDate) {
    errors.startDate = 'Please choose a start date for this bill.';
  }

  if (values.endDate && values.startDate && values.endDate <= values.startDate) {
    errors.endDate = 'End date must be after the start date, or leave it empty for an ongoing bill.';
  }

  return errors;
}

function toIsoDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toISOString();
}

export default function RecurringBillForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length > 0) return;
    if (!values.frequency) return;

    setIsSaving(true);
    try {
      const startDate = toIsoDay(values.startDate);
      await createRecurringBill({
        name: values.name.trim(),
        amount: Number(values.amount),
        frequency: values.frequency,
        startDate,
        nextDueDate: startDate,
        endDate: values.endDate ? toIsoDay(values.endDate) : null,
        status: 'active',
      });
      router.push(RECURRING_BILLS_PATH);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Could not save this bill. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form data-nexen-component="nx_components_RecurringBillForm"
      onSubmit={handleSubmit}
      noValidate
      className="w-full max-w-2xl rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm sm:p-6"
     data-nexen-id="nx-7e7c5660-0">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0 sm:col-span-2">
          <label htmlFor="rb-name" className={labelClass} data-nexen-id="nx-7e7c5660-1">Bill name</label>
          <input
            id="rb-name"
            type="text"
            value={values.name}
            maxLength={200}
            onChange={(e) => update('name', e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors.name)}
           data-nexen-id="nx-7e7c5660-2"/>
          {errors.name && <p className={errorClass} data-nexen-id="nx-7e7c5660-3">{errors.name}</p>}
        </div>

        <div className="min-w-0">
          <label htmlFor="rb-amount" className={labelClass} data-nexen-id="nx-7e7c5660-4">Amount</label>
          <input
            id="rb-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max={MAX_AMOUNT}
            value={values.amount}
            onChange={(e) => update('amount', e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors.amount)}
           data-nexen-id="nx-7e7c5660-5"/>
          {errors.amount && <p className={errorClass} data-nexen-id="nx-7e7c5660-6">{errors.amount}</p>}
        </div>

        <div className="min-w-0">
          <label htmlFor="rb-frequency" className={labelClass} data-nexen-id="nx-7e7c5660-7">Repeats</label>
          <select
            id="rb-frequency"
            value={values.frequency}
            onChange={(e) => update('frequency', e.target.value as FormState['frequency'])}
            className={inputClass}
            aria-invalid={Boolean(errors.frequency)}
           data-nexen-id="nx-7e7c5660-8">
            <option value="">Select how often</option>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          {errors.frequency && <p className={errorClass} data-nexen-id="nx-7e7c5660-9">{errors.frequency}</p>}
        </div>

        <div className="min-w-0">
          <label htmlFor="rb-start" className={labelClass} data-nexen-id="nx-7e7c5660-10">Start date (first due date)</label>
          <input
            id="rb-start"
            type="date"
            value={values.startDate}
            onChange={(e) => update('startDate', e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors.startDate)}
           data-nexen-id="nx-7e7c5660-11"/>
          {errors.startDate && <p className={errorClass} data-nexen-id="nx-7e7c5660-12">{errors.startDate}</p>}
        </div>

        <div className="min-w-0">
          <label htmlFor="rb-end" className={labelClass} data-nexen-id="nx-7e7c5660-13">End date (optional)</label>
          <input
            id="rb-end"
            type="date"
            value={values.endDate}
            onChange={(e) => update('endDate', e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(errors.endDate)}
           data-nexen-id="nx-7e7c5660-14"/>
          {errors.endDate && <p className={errorClass} data-nexen-id="nx-7e7c5660-15">{errors.endDate}</p>}
        </div>
      </div>

      {submitError && (
        <p role="alert" className="mt-4 rounded-[var(--radius)] bg-destructive/10 px-3 py-2 text-sm text-destructive" data-nexen-id="nx-7e7c5660-16">
          {submitError}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => router.push(RECURRING_BILLS_PATH)}
          className="h-10 rounded-[var(--radius)] border border-border bg-transparent px-5 text-sm font-semibold text-foreground"
         data-nexen-id="nx-7e7c5660-17">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="h-10 rounded-[var(--radius)] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
         data-nexen-id="nx-7e7c5660-18">
          {isSaving ? 'Saving…' : 'Save bill'}
        </button>
      </div>
    </form>
  );
}