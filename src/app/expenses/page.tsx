'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  ApiError,
  deleteAdminExpens,
  deleteMyExpens,
  getAdminExpenses,
  getMyExpenses,
  updateAdminExpens,
  updateMyExpens,
} from '@/lib/api';
import type { Expens } from '@/types/expens';

type ExpenseDraft = { description: string; amount: string; category: string; expenseDate: string };

const btn =
  'inline-flex items-center rounded-[var(--radius)] border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50';
const input =
  'w-full min-w-0 rounded-[var(--radius)] border border-input bg-background px-2 py-1.5 text-sm';

export default function ExpensesPage() {
  const router = useRouter();
  const { isOwner, isAuthenticated, isLoading: userLoading, business } = useCurrentUser();
  const currency = business?.currency || 'USD';

  const [expenses, setExpenses] = useState<Expens[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>({ description: '', amount: '', category: '', expenseDate: '' });
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && !isAuthenticated) router.replace('/login');
  }, [userLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    try {
      const rows = isOwner ? await getAdminExpenses() : await getMyExpenses();
      setExpenses(Array.isArray(rows) ? rows : []);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load expenses.');
    }
  }, [isOwner]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  const rows = Array.isArray(expenses)
    ? [...expenses].sort((a, b) => String(b.expenseDate).localeCompare(String(a.expenseDate)))
    : [];

  const money = (value: number | string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value));

  const startEdit = (e: Expens) => {
    setEditingId(e.id);
    setEditError(null);
    setDraft({
      description: e.description ?? '',
      amount: String(e.amount),
      category: e.category ?? '',
      expenseDate: String(e.expenseDate).slice(0, 10),
    });
  };

  const saveEdit = async (id: string) => {
    const today = new Date().toLocaleDateString('en-CA');
    const amount = Number(draft.amount);
    if (!(amount > 0) || amount > 1000000) return setEditError('Enter an amount greater than 0.');
    if (!draft.expenseDate || draft.expenseDate > today) return setEditError('Choose a date on or before today.');
    if (!draft.category.trim()) return setEditError('Select a category for this expense.');
    if (draft.description.length > 200) return setEditError('Description must be 200 characters or fewer.');

    setBusyId(id);
    try {
      const payload = { description: draft.description, amount, category: draft.category.trim(), expenseDate: draft.expenseDate };
      const updated = isOwner ? await updateAdminExpens(id, payload) : await updateMyExpens(id, payload);
      setExpenses((prev) => (prev ?? []).map((x) => (x.id === id ? updated : x)));
      setEditingId(null);
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : 'Could not save this expense.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return;
    setBusyId(id);
    try {
      if (isOwner) await deleteAdminExpens(id);
      else await deleteMyExpens(id);
      setExpenses((prev) => (prev ?? []).filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete this expense.');
    } finally {
      setBusyId(null);
    }
  };

  if (userLoading || !isAuthenticated) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-8976e64d-0">Loading…</p>;
  }

  return (
    <main data-nexen-component="nx_app_expenses_page" className="mx-auto w-full max-w-5xl min-w-0 space-y-6 p-4 sm:p-6" data-nexen-id="nx-8976e64d-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" data-nexen-id="nx-8976e64d-2">Expenses</h1>
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-8976e64d-3">Business spending, newest first.</p>
        </div>
        <Link
          href="/expenses/new"
          className="inline-flex items-center justify-center rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
         data-nexen-id="nx-8976e64d-4">
          Record expense
        </Link>
      </div>

      {error && <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-8976e64d-5">{error}</p>}

      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card shadow-sm">
        {expenses === null ? (
          <p className="p-4 text-sm text-muted-foreground" data-nexen-id="nx-8976e64d-6">Loading expenses…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-nexen-id="nx-8976e64d-7">No expenses recorded yet.</p>
        ) : (
          <table className="w-full text-left text-sm" data-nexen-id="nx-8976e64d-8">
            <thead className="border-b border-border text-muted-foreground" data-nexen-id="nx-8976e64d-9">
              <tr data-nexen-id="nx-8976e64d-10">
                <th className="px-4 py-3 font-medium" data-nexen-id="nx-8976e64d-11">Description</th>
                <th className="px-4 py-3 font-medium" data-nexen-id="nx-8976e64d-12">Category</th>
                <th className="px-4 py-3 font-medium" data-nexen-id="nx-8976e64d-13">Date</th>
                <th className="px-4 py-3 text-right font-medium" data-nexen-id="nx-8976e64d-14">Amount</th>
                <th className="px-4 py-3 font-medium" data-nexen-id="nx-8976e64d-15"><span className="sr-only" data-nexen-id="nx-8976e64d-16">Actions</span></th>
              </tr>
            </thead>
            <tbody data-nexen-id="nx-8976e64d-17">
              {rows.map((e) =>
                editingId === e.id ? (
                  <tr key={e.id} className="border-b border-border align-top" data-nexen-id="nx-8976e64d-18">
                    <td colSpan={5} className="px-4 py-3" data-nexen-id="nx-8976e64d-19">
                      <div className="grid gap-2 sm:grid-cols-4">
                        <input className={input} aria-label="Description" value={draft.description}
                          onChange={(ev) => setDraft({ ...draft, description: ev.target.value })}  data-nexen-id="nx-8976e64d-20"/>
                        <input className={input} aria-label="Category" value={draft.category}
                          onChange={(ev) => setDraft({ ...draft, category: ev.target.value })}  data-nexen-id="nx-8976e64d-21"/>
                        <input className={input} aria-label="Date" type="date" value={draft.expenseDate}
                          onChange={(ev) => setDraft({ ...draft, expenseDate: ev.target.value })}  data-nexen-id="nx-8976e64d-22"/>
                        <input className={input} aria-label="Amount" inputMode="decimal" value={draft.amount}
                          onChange={(ev) => setDraft({ ...draft, amount: ev.target.value })}  data-nexen-id="nx-8976e64d-23"/>
                      </div>
                      {editError && <p role="alert" className="mt-2 text-sm text-destructive" data-nexen-id="nx-8976e64d-24">{editError}</p>}
                      <div className="mt-3 flex gap-2">
                        <button type="button" className={btn} disabled={busyId === e.id}
                          onClick={() => saveEdit(e.id)} data-nexen-id="nx-8976e64d-25">Save</button>
                        <button type="button" className={btn} onClick={() => setEditingId(null)} data-nexen-id="nx-8976e64d-26">Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id} className="border-b border-border" data-nexen-id="nx-8976e64d-27">
                    <td className="min-w-0 px-4 py-3" data-nexen-id="nx-8976e64d-28">{e.description}</td>
                    <td className="px-4 py-3" data-nexen-id="nx-8976e64d-29">{e.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap" data-nexen-id="nx-8976e64d-30">{String(e.expenseDate).slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" data-nexen-id="nx-8976e64d-31">{money(e.amount)}</td>
                    <td className="px-4 py-3" data-nexen-id="nx-8976e64d-32">
                      <div className="flex justify-end gap-2">
                        <button type="button" className={btn} disabled={busyId === e.id}
                          onClick={() => startEdit(e)} data-nexen-id="nx-8976e64d-33">Edit</button>
                        <button type="button" className={`${btn} text-destructive`} disabled={busyId === e.id}
                          onClick={() => remove(e.id)} data-nexen-id="nx-8976e64d-34">Delete</button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}