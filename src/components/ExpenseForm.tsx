'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, createExpens } from '@/lib/api';

export const EXPENSE_CATEGORIES = [
  'Software',
  'Hardware',
  'Stock media',
  'Music and sound',
  'Equipment rental',
  'Contractors',
  'Travel',
  'Office',
  'Marketing',
  'Other',
] as const;

type ProjectOption = { id: string; name: string };

type ExpenseFormProps = {
  projects?: ProjectOption[];
};

const MAX_AMOUNT = 1_000_000;
const inputClass =
  'w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

function validateExpense(
  amount: string,
  category: string,
  expenseDate: string,
  projectId: string,
  projectOptions: ProjectOption[],
): string | null {
  const parsed = Number(amount);
  if (!amount.trim() || Number.isNaN(parsed) || parsed <= 0 || parsed > MAX_AMOUNT) {
    return 'Enter an amount greater than 0.';
  }
  if (!expenseDate) {
    return 'Choose a date on or before today.';
  }
  const today = new Date().toLocaleDateString('en-CA');
  if (expenseDate > today) {
    return 'Choose a date on or before today.';
  }
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
    return 'Select a category for this expense.';
  }
  if (projectId && !projectOptions.some((p) => p.id === projectId)) {
    return "Choose one of your existing projects, or leave this blank.";
  }
  return null;
}

export default function ExpenseForm({ projects }: ExpenseFormProps) {
  const router = useRouter();
  const projectOptions = Array.isArray(projects) ? projects : [];

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validateExpense(amount, category, expenseDate, projectId, projectOptions);
    if (message) {
      setError(message);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createExpens({
        amount: Number(amount),
        category,
        expenseDate,
        ...(projectId ? { projectId } : {}),
      });
      router.push('/expenses');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the expense. Try again.');
      setSaving(false);
    }
  }

  return (
    <form data-nexen-component="nx_components_ExpenseForm" onSubmit={handleSubmit} noValidate className="w-full max-w-xl space-y-5" data-nexen-id="nx-99490fa5-0">
      {error && (
        <div
          role="alert"
          className="rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="expense-amount" className="text-sm font-medium text-foreground" data-nexen-id="nx-99490fa5-1">
          Amount
        </label>
        <input
          id="expense-amount"
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          max={MAX_AMOUNT}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
         data-nexen-id="nx-99490fa5-2"/>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="expense-category" className="text-sm font-medium text-foreground" data-nexen-id="nx-99490fa5-3">
          Category
        </label>
        <select
          id="expense-category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
         data-nexen-id="nx-99490fa5-4">
          <option value="">Select a category</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="expense-date" className="text-sm font-medium text-foreground" data-nexen-id="nx-99490fa5-5">
          Date
        </label>
        <input
          id="expense-date"
          name="expenseDate"
          type="date"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
          className={inputClass}
         data-nexen-id="nx-99490fa5-6"/>
      </div>

      {projectOptions.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="expense-project" className="text-sm font-medium text-foreground" data-nexen-id="nx-99490fa5-7">
            Project (optional)
          </label>
          <select
            id="expense-project"
            name="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={inputClass}
           data-nexen-id="nx-99490fa5-8">
            <option value="">No project</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
         data-nexen-id="nx-99490fa5-9">
          {saving ? 'Saving expense…' : 'Save expense'}
        </button>
        <Link
          href="/expenses"
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
         data-nexen-id="nx-99490fa5-10">
          Cancel
        </Link>
      </div>
    </form>
  );
}