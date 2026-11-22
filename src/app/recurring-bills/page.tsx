'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  getAdminRecurringBills,
  getMyRecurringBills,
  createAdminRecurringBillMarkPaid,
  createMyRecurringBillMarkPaid,
  createRecurringBillPause,
  createRecurringBillResume,
  createRecurringBillEnd,
  deleteRecurringBill,
} from '@/lib/api';

type Bill = Awaited<ReturnType<typeof getMyRecurringBills>>[number];
type DueState = 'overdue' | 'due' | 'pending';

const OWNER_ROLE = 'small_video_editing_business_owner';
const DAY_MS = 86400000;

function dueState(bill: Bill, today: Date): DueState {
  const diffDays = Math.floor((new Date(bill.nextDueDate).getTime() - today.getTime()) / DAY_MS);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 7) return 'due';
  return 'pending';
}

function formatAmount(value: unknown): string {
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: unknown): string {
  return new Date(value as string).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const STATE_LABEL: Record<DueState, string> = { overdue: 'Overdue', due: 'Due', pending: 'Pending' };
const STATE_CLASS: Record<DueState, string> = {
  overdue: 'text-destructive font-semibold',
  due: 'text-primary font-semibold',
  pending: 'text-muted-foreground',
};

export default function RecurringBillsPage() {
  const auth = useAuth();
  const router = useRouter();
  const isOwner = auth.user?.role === OWNER_ROLE;

  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    setToday(new Date());
  }, []);

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) router.replace('/login');
  }, [auth.loading, auth.isAuthenticated, router]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = isOwner ? await getAdminRecurringBills() : await getMyRecurringBills();
      setBills(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load recurring bills.');
    } finally {
      setIsLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (auth.isAuthenticated) void load();
  }, [auth.isAuthenticated, load]);

  async function runAction(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'That action could not be completed.');
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...bills].sort(
    (a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime(),
  );

  const btn = 'inline-flex h-8 items-center rounded-[var(--radius)] border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50';

  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 space-y-6 p-4 sm:p-6" data-nexen-id="nx-90c34b56-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-nexen-id="nx-90c34b56-1">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" data-nexen-id="nx-90c34b56-2">Recurring bills</h1>
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-90c34b56-3">Bills you owe on a schedule, soonest due first.</p>
        </div>
        <Link
          href="/recurring-bills/new"
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground"
         data-nexen-id="nx-90c34b56-4">
          Set up a bill
        </Link>
      </header>

      {error && (
        <div role="alert" className="rounded-[var(--radius)] border border-border bg-card p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {actionError && (
        <div role="alert" className="rounded-[var(--radius)] border border-border bg-card p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {isLoading && bills.length === 0 && (
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-90c34b56-5">Loading recurring bills…</p>
      )}

      {!isLoading && !error && sorted.length === 0 && (
        <div className="rounded-[var(--radius)] border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-90c34b56-6">No recurring bills yet. Set up your first repeating bill to see what is owed and when.</p>
          <Link href="/recurring-bills/new" className="mt-3 inline-block text-sm font-semibold text-primary" data-nexen-id="nx-90c34b56-7">
            Set up a recurring bill
          </Link>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="w-full overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm" data-nexen-id="nx-90c34b56-8">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-90c34b56-9">
              <tr data-nexen-id="nx-90c34b56-10">
                <th className="p-3 font-medium" data-nexen-id="nx-90c34b56-11">Bill</th>
                <th className="p-3 font-medium" data-nexen-id="nx-90c34b56-12">Amount</th>
                <th className="p-3 font-medium" data-nexen-id="nx-90c34b56-13">Repeats</th>
                <th className="p-3 font-medium" data-nexen-id="nx-90c34b56-14">Next due</th>
                <th className="p-3 font-medium" data-nexen-id="nx-90c34b56-15">Status</th>
                <th className="p-3 font-medium" data-nexen-id="nx-90c34b56-16">Actions</th>
              </tr>
            </thead>
            <tbody data-nexen-id="nx-90c34b56-17">
              {sorted.map((bill) => {
                const state = today ? dueState(bill, today) : 'pending';
                const ended = bill.status === 'ended';
                const busy = busyId === bill.id;
                return (
                  <tr data-nexen-component="nx_app_recurring_bills_page" key={bill.id} className="border-t border-border align-top" data-nexen-id="nx-90c34b56-18">
                    <td className="p-3 font-medium" data-nexen-id="nx-90c34b56-19">{bill.name}</td>
                    <td className="p-3" data-nexen-id="nx-90c34b56-20">{formatAmount(bill.amount)}</td>
                    <td className="p-3 capitalize" data-nexen-id="nx-90c34b56-21">{bill.frequency}</td>
                    <td className="p-3" data-nexen-id="nx-90c34b56-22">
                      {formatDate(bill.nextDueDate)}
                      {!ended && today && <span className={`ml-2 text-xs ${STATE_CLASS[state]}`} data-nexen-id="nx-90c34b56-23">{STATE_LABEL[state]}</span>}
                    </td>
                    <td className="p-3 capitalize" data-nexen-id="nx-90c34b56-24">{bill.status}</td>
                    <td className="p-3" data-nexen-id="nx-90c34b56-25">
                      <div className="flex flex-wrap gap-2">
                        {bill.status === 'active' && (
                          <button
                            type="button"
                            disabled={busy}
                            className={btn}
                            onClick={() =>
                              runAction(bill.id, () =>
                                isOwner
                                  ? createAdminRecurringBillMarkPaid(bill.id, {})
                                  : createMyRecurringBillMarkPaid(bill.id, {}),
                              )
                            }
                           data-nexen-id="nx-90c34b56-26">
                            Mark paid
                          </button>
                        )}
                        {bill.status === 'active' && (
                          <button
                            type="button"
                            disabled={busy}
                            className={btn}
                            onClick={() => runAction(bill.id, () => createRecurringBillPause(bill.id, {}))}
                           data-nexen-id="nx-90c34b56-27">
                            Pause
                          </button>
                        )}
                        {bill.status === 'paused' && (
                          <button
                            type="button"
                            disabled={busy}
                            className={btn}
                            onClick={() => runAction(bill.id, () => createRecurringBillResume(bill.id, {}))}
                           data-nexen-id="nx-90c34b56-28">
                            Resume
                          </button>
                        )}
                        {!ended && (
                          <button
                            type="button"
                            disabled={busy}
                            className={btn}
                            onClick={() => {
                              if (window.confirm(`End "${bill.name}"? No further due dates will be generated.`)) {
                                void runAction(bill.id, () => createRecurringBillEnd(bill.id, {}));
                              }
                            }}
                           data-nexen-id="nx-90c34b56-29">
                            End
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          className={`${btn} text-destructive`}
                          onClick={() => {
                            if (window.confirm(`Delete "${bill.name}"?`)) {
                              void runAction(bill.id, () => deleteRecurringBill(bill.id));
                            }
                          }}
                         data-nexen-id="nx-90c34b56-30">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}