'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  createAdminWeeklyBusinessReviewPriority,
  createMyWeeklyBusinessReviewPriority,
  getAdminExpenses,
  getAdminOutstandingPayments,
  getAdminPayments,
  getAdminTasks,
  getAdminWeeklyBusinessReview,
  getMyExpenses,
  getMyOutstandingPayments,
  getMyPayments,
  getMyTasks,
  getMyWeeklyBusinessReview,
} from '@/lib/api';

const OWNER_ROLE = 'small_video_editing_business_owner';
const PRIORITY_LEVELS = ['high', 'medium', 'low'];
const MAX_PRIORITIES = 5;
const MAX_NOTE_LENGTH = 280;

type ReviewData = {
  week_start: string;
  completed_projects: Array<{ id: string; name: string; completedAt?: string | Date | null }>;
  payments_collected: number;
  expenses_total: number;
  overdue_invoices: number;
  goal_progress: number[];
  priorities: Array<{ id: string; title: string; priority: string; priorityNote?: string | null }>;
};
type PaymentList = Awaited<ReturnType<typeof getMyPayments>>;
type ExpenseList = Awaited<ReturnType<typeof getMyExpenses>>;
type TaskList = Awaited<ReturnType<typeof getMyTasks>>;
type OverdueList = Awaited<ReturnType<typeof getMyOutstandingPayments>>;
type PriorityDraft = { priority: string; note: string };

function shiftDay(day: string, offset: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dayOf(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

function nextMonday(today: string): string {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const add = (8 - dow) % 7 || 7;
  return shiftDay(today, add);
}

function formatAmount(value: unknown): string {
  return Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WeeklyBusinessReviewPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const isOwner = user?.role === OWNER_ROLE;

  const [today, setToday] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [reviewError, setReviewError] = useState(false);
  const [payments, setPayments] = useState<PaymentList>([]);
  const [expenses, setExpenses] = useState<ExpenseList>([]);
  const [tasks, setTasks] = useState<TaskList>([]);
  const [overdue, setOverdue] = useState<OverdueList>([]);
  const [drafts, setDrafts] = useState<Record<string, PriorityDraft>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-CA'));
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated, router]);

  const load = useCallback(async (day: string, owner: boolean) => {
    setDataLoading(true);
    const weekStart = shiftDay(day, -6);
    const [r, p, e, o, t] = await Promise.allSettled([
      owner ? getAdminWeeklyBusinessReview({ week_start: weekStart }) : getMyWeeklyBusinessReview({ week_start: weekStart }),
      owner ? getAdminPayments() : getMyPayments(),
      owner ? getAdminExpenses() : getMyExpenses(),
      owner ? getAdminOutstandingPayments() : getMyOutstandingPayments(),
      owner ? getAdminTasks() : getMyTasks(),
    ]);
    setReview(r.status === 'fulfilled' ? r.value : null);
    setReviewError(r.status === 'rejected');
    if (p.status === 'fulfilled') setPayments(p.value);
    if (e.status === 'fulfilled') setExpenses(e.value);
    if (o.status === 'fulfilled') setOverdue(o.value);
    if (t.status === 'fulfilled') setTasks(t.value);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (!today || !isAuthenticated) return;
    void load(today, isOwner);
  }, [today, isAuthenticated, isOwner, load]);

  useEffect(() => {
    if (!review) return;
    const initial: Record<string, PriorityDraft> = {};
    for (const task of review.priorities) {
      initial[task.id] = { priority: task.priority, note: task.priorityNote ?? '' };
    }
    setDrafts(initial);
  }, [review]);

  function toggleTask(taskId: string) {
    setFormError(null);
    setSaved(false);
    setDrafts((prev) => {
      if (prev[taskId]) {
        const next = { ...prev };
        delete next[taskId];
        return next;
      }
      if (Object.keys(prev).length >= MAX_PRIORITIES) {
        setFormError(`You can choose at most ${MAX_PRIORITIES} priorities for next week.`);
        return prev;
      }
      return { ...prev, [taskId]: { priority: '', note: '' } };
    });
  }

  function updateDraft(taskId: string, patch: Partial<PriorityDraft>) {
    setSaved(false);
    setDrafts((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...patch } }));
  }

  async function savePriorities() {
    if (!today) return;
    const entries = Object.entries(drafts);
    for (const [, draft] of entries) {
      if (!PRIORITY_LEVELS.includes(draft.priority)) {
        setFormError('Choose a priority level (high, medium or low) for each selected task.');
        return;
      }
      if (draft.note.length > MAX_NOTE_LENGTH) {
        setFormError('Priority note must be 280 characters or fewer.');
        return;
      }
    }
    if (entries.length > MAX_PRIORITIES) {
      setFormError(`You can choose at most ${MAX_PRIORITIES} priorities for next week.`);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        week_start: nextMonday(today),
        priorities: entries.map(([taskId, draft]) => ({
          task_id: taskId,
          priority: draft.priority,
          priority_note: draft.note.trim() || undefined,
        })),
      };
      if (isOwner) {
        await createAdminWeeklyBusinessReviewPriority(payload);
      } else {
        await createMyWeeklyBusinessReviewPriority(payload);
      }
      setSaved(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save priorities.');
    } finally {
      setSaving(false);
    }
  }

  if (!today || loading || !isAuthenticated) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-0">Loading…</p>;
  }

  const weekStart = shiftDay(today, -6);
  const weekPayments = payments.filter((p) => {
    const day = dayOf(p.receivedAt);
    return p.status === 'received' && day >= weekStart && day <= today;
  });
  const weekExpenses = expenses.filter((x) => {
    const day = dayOf(x.expenseDate);
    return day >= weekStart && day <= today;
  });
  const overdueRows = overdue.filter((o) => o.days_overdue > 0);
  const openTasks = tasks.filter((t) => t.status === 'open');
  const draftIds = Object.keys(drafts);

  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 space-y-6 p-4 sm:p-6" data-nexen-id="nx-d3e94cb6-1">
      <header className="min-w-0 space-y-1" data-nexen-id="nx-d3e94cb6-2">
        <h1 className="text-2xl font-bold" data-nexen-id="nx-d3e94cb6-3">Weekly Business Review</h1>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-4">
          {weekStart} to {today}
        </p>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-5">
          Completed projects, goal progress, payments, expenses and problems for the past week.
        </p>
      </header>

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-d3e94cb6-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold" data-nexen-id="nx-d3e94cb6-7">Completed projects</h2>
          <span className="text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-8">
            {review ? `${review.completed_projects.length} completed this week` : ''}
          </span>
        </div>
        {reviewError ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-destructive">
            <span data-nexen-id="nx-d3e94cb6-9">Records could not be loaded.</span>
            <button type="button" className="underline" onClick={() => load(today, isOwner)} data-nexen-id="nx-d3e94cb6-10">Retry</button>
          </div>
        ) : dataLoading && !review ? (
          <p className="mt-3 text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-11">Loading…</p>
        ) : !review || review.completed_projects.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-12">No projects completed this week yet.</p>
        ) : (
          <ul className="mt-3 space-y-2" data-nexen-id="nx-d3e94cb6-13">
            {review.completed_projects.map((project) => (
              <li key={project.id} className="min-w-0" data-nexen-id="nx-d3e94cb6-14">
                <Link href={`/projects/${project.id}`} className="flex flex-col gap-1 rounded-[var(--radius)] border p-3 text-sm hover:bg-muted sm:flex-row sm:justify-between" data-nexen-id="nx-d3e94cb6-15">
                  <span className="min-w-0 truncate font-medium" data-nexen-id="nx-d3e94cb6-16">{project.name}</span>
                  <span className="text-muted-foreground" data-nexen-id="nx-d3e94cb6-17">{dayOf(project.completedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-d3e94cb6-18">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold" data-nexen-id="nx-d3e94cb6-19">Goal progress</h2>
          <Link href="/goals" className="text-sm underline text-muted-foreground" data-nexen-id="nx-d3e94cb6-20">Open goals</Link>
        </div>
        {!review || review.goal_progress.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-21">No monthly goal is active this week.</p>
        ) : (
          <ul className="mt-3 space-y-3" data-nexen-id="nx-d3e94cb6-22">
            {review.goal_progress.map((percent, index) => (
              <li key={index} className="min-w-0 space-y-1" data-nexen-id="nx-d3e94cb6-23">
                <div className="flex justify-between text-sm">
                  <span data-nexen-id="nx-d3e94cb6-24">Goal {index + 1}</span>
                  <span className="text-muted-foreground" data-nexen-id="nx-d3e94cb6-25">{Math.min(100, Math.round(percent))}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, percent)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-d3e94cb6-26">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold" data-nexen-id="nx-d3e94cb6-27">Payments collected</h2>
          <span className="text-sm font-medium" data-nexen-id="nx-d3e94cb6-28">Total: {formatAmount(review?.payments_collected)}</span>
        </div>
        {weekPayments.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-29">No payments received this week yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <ul className="space-y-2" data-nexen-id="nx-d3e94cb6-30">
              {weekPayments.map((payment) => (
                <li key={payment.id} className="min-w-0" data-nexen-id="nx-d3e94cb6-31">
                  <Link href={`/invoices/${payment.invoiceId}`} className="flex flex-col gap-1 rounded-[var(--radius)] border p-3 text-sm hover:bg-muted sm:flex-row sm:justify-between" data-nexen-id="nx-d3e94cb6-32">
                    <span className="min-w-0 truncate" data-nexen-id="nx-d3e94cb6-33">Invoice {payment.invoiceId.slice(0, 8)}</span>
                    <span className="font-medium" data-nexen-id="nx-d3e94cb6-34">{formatAmount(payment.amount)}</span>
                    <span className="text-muted-foreground" data-nexen-id="nx-d3e94cb6-35">{dayOf(payment.receivedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-d3e94cb6-36">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold" data-nexen-id="nx-d3e94cb6-37">Expenses</h2>
          <span className="text-sm font-medium" data-nexen-id="nx-d3e94cb6-38">Total spent: {formatAmount(review?.expenses_total)}</span>
        </div>
        {weekExpenses.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-39">No expenses recorded this week yet.</p>
        ) : (
          <ul className="mt-3 space-y-2" data-nexen-id="nx-d3e94cb6-40">
            {weekExpenses.map((expense) => (
              <li key={expense.id} className="min-w-0" data-nexen-id="nx-d3e94cb6-41">
                <Link href="/expenses" className="flex flex-col gap-1 rounded-[var(--radius)] border p-3 text-sm hover:bg-muted sm:flex-row sm:justify-between" data-nexen-id="nx-d3e94cb6-42">
                  <span className="min-w-0 truncate" data-nexen-id="nx-d3e94cb6-43">{expense.category}</span>
                  <span className="font-medium" data-nexen-id="nx-d3e94cb6-44">{formatAmount(expense.amount)}</span>
                  <span className="text-muted-foreground" data-nexen-id="nx-d3e94cb6-45">{dayOf(expense.expenseDate)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-d3e94cb6-46">
        <h2 className="text-lg font-semibold" data-nexen-id="nx-d3e94cb6-47">Problems</h2>
        {overdueRows.length === 0 && (review?.overdue_invoices ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-48">No problems this week.</p>
        ) : (
          <ul className="mt-3 space-y-2" data-nexen-id="nx-d3e94cb6-49">
            <li className="text-sm text-destructive" data-nexen-id="nx-d3e94cb6-50">{review?.overdue_invoices ?? overdueRows.length} overdue invoice(s) with an unpaid balance.</li>
            {overdueRows.map((row) => (
              <li key={row.invoice_id} className="min-w-0" data-nexen-id="nx-d3e94cb6-51">
                <Link href="/outstanding-payments" className="flex flex-col gap-1 rounded-[var(--radius)] border p-3 text-sm hover:bg-muted sm:flex-row sm:justify-between" data-nexen-id="nx-d3e94cb6-52">
                  <span className="min-w-0 truncate" data-nexen-id="nx-d3e94cb6-53">Invoice {row.invoice_number} for {row.client_name}</span>
                  <span className="text-muted-foreground" data-nexen-id="nx-d3e94cb6-54">{row.days_overdue} days overdue</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-d3e94cb6-55">
        <h2 className="text-lg font-semibold" data-nexen-id="nx-d3e94cb6-56">Next week&apos;s priorities</h2>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-57">Choose up to {MAX_PRIORITIES} open tasks and set a priority for each.</p>
        {openTasks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-58">No open tasks to prioritise.</p>
        ) : (
          <ul className="mt-3 space-y-3" data-nexen-id="nx-d3e94cb6-59">
            {openTasks.map((task) => {
              const draft = drafts[task.id];
              const checked = Boolean(draft);
              return (
                <li data-nexen-component="nx_app_weekly_business_review_page" key={task.id} className="min-w-0 space-y-2 rounded-[var(--radius)] border p-3" data-nexen-id="nx-d3e94cb6-60">
                  <label className="flex min-w-0 items-center gap-2 text-sm" data-nexen-id="nx-d3e94cb6-61">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && draftIds.length >= MAX_PRIORITIES}
                      onChange={() => toggleTask(task.id)}
                     data-nexen-id="nx-d3e94cb6-62"/>
                    <span className="min-w-0 truncate font-medium" data-nexen-id="nx-d3e94cb6-63">{task.title}</span>
                  </label>
                  {checked && (
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                      <select
                        aria-label="Priority level"
                        className="rounded-[var(--radius)] border bg-background p-2 text-sm"
                        value={draft.priority}
                        onChange={(e) => updateDraft(task.id, { priority: e.target.value })}
                       data-nexen-id="nx-d3e94cb6-64">
                        <option value="">Select priority</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      <input
                        type="text"
                        aria-label="Priority note"
                        placeholder="Why is this a priority? (optional)"
                        maxLength={MAX_NOTE_LENGTH}
                        className="min-w-0 flex-1 rounded-[var(--radius)] border bg-background p-2 text-sm"
                        value={draft.note}
                        onChange={(e) => updateDraft(task.id, { note: e.target.value })}
                       data-nexen-id="nx-d3e94cb6-65"/>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {formError && <p className="mt-3 text-sm text-destructive" data-nexen-id="nx-d3e94cb6-66">{formError}</p>}
        {saved && <p className="mt-3 text-sm text-muted-foreground" data-nexen-id="nx-d3e94cb6-67">Priorities saved for next week.</p>}
        <div className="mt-4">
          <button
            type="button"
            onClick={savePriorities}
            disabled={saving || openTasks.length === 0}
            className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
           data-nexen-id="nx-d3e94cb6-68">
            {saving ? 'Saving…' : 'Save priorities'}
          </button>
        </div>
      </section>
    </main>
  );
}