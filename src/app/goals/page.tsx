'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  createAdminGoal,
  deleteAdminGoal,
  getAdminGoals,
  getAdminWorkloadSummary,
  updateAdminGoal,
} from '@/lib/api';
import type { Goal } from '@/types/goal';

type GoalRow = { goal: Goal; completed_count: number; progress_percent: number };
type WorkloadWeek = {
  week_start: string;
  workload_percent: number;
  capacity_hours: number;
  open_task_count: number;
  active_project_count: number;
};

const OWNER_ROLE = 'small_video_editing_business_owner';

function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

export default function GoalsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isOwner = user?.role === OWNER_ROLE;

  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [workload, setWorkload] = useState<WorkloadWeek[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState('');
  const [month, setMonth] = useState('');
  const [target, setTarget] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const now = new Date().toLocaleDateString('en-CA');
    setToday(now);
    setMonth(now.slice(0, 7));
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [g, w] = await Promise.all([getAdminGoals(), getAdminWorkloadSummary({ weeks: 4 })]);
      setGoals(Array.isArray(g) ? (g as GoalRow[]) : []);
      setWorkload(Array.isArray(w) ? (w as WorkloadWeek[]) : []);
    } catch (e) {
      setError(message(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOwner) void load();
    else if (!authLoading) setIsLoading(false);
  }, [isOwner, authLoading, load]);

  const current = goals.find((r) => String(r.goal.periodStart).slice(0, 7) === month) ?? null;
  const monthEnded = month !== '' && lastDayOf(month) < today;
  const completed = current?.completed_count ?? 0;
  const targetCount = current?.goal.targetProjectCount ?? 0;
  const remaining = Math.max(0, targetCount - completed);
  const peak = workload.reduce((max, w) => Math.max(max, w.workload_percent), 0);

  let guidance: string;
  if (!current) {
    guidance = 'Set a target for this month to start tracking progress.';
  } else if (remaining === 0) {
    guidance = 'Goal reached. Keep new projects paced so next month starts clean.';
  } else if (peak > 100) {
    guidance = `Workload peaks at ${Math.round(peak)}%. Move a deadline before adding more work.`;
  } else {
    guidance = `${remaining} more completion${remaining === 1 ? '' : 's'} needed by ${current.goal.periodEnd}. Workload peaks at ${Math.round(peak)}%.`;
  }

  async function saveGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const raw = target.trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setFormError('Select a valid month for this goal.');
      return;
    }
    if (!raw) {
      setFormError('Enter a monthly project target to save your goal.');
      return;
    }
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || n < 1 || n > 50) {
      setFormError('Enter a whole number of projects between 1 and 50.');
      return;
    }
    if (monthEnded) {
      setFormError('This month has ended, so its goal is read-only.');
      return;
    }
    setIsSaving(true);
    try {
      if (current) {
        await updateAdminGoal(current.goal.id, { targetProjectCount: n });
      } else {
        await createAdminGoal({
          title: `Project completions ${month}`,
          periodStart: `${month}-01`,
          periodEnd: lastDayOf(month),
          targetProjectCount: n,
        });
      }
      setTarget('');
      await load();
    } catch (err) {
      setFormError(message(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function removeGoal(goalId: string) {
    try {
      await deleteAdminGoal(goalId);
      await load();
    } catch (err) {
      setError(message(err));
    }
  }

  if (authLoading) return <p className="p-6 text-muted-foreground" data-nexen-id="nx-89b6658b-0">Loading…</p>;
  if (!isAuthenticated) return null;
  if (!isOwner) {
    return (
      <div className="p-6 text-muted-foreground">
        Goals are not available for your role.
      </div>
    );
  }

  return (
    <div data-nexen-component="nx_app_goals_page" className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="min-w-0" data-nexen-id="nx-89b6658b-1">
        <h1 className="text-2xl font-bold" data-nexen-id="nx-89b6658b-2">Monthly goals</h1>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-89b6658b-3">
          Track completed projects against your monthly target and check workload.
        </p>
      </header>

      {error && (
        <div className="rounded-[var(--radius)] border border-destructive bg-card p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="min-w-0 space-y-4 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-89b6658b-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold" data-nexen-id="nx-89b6658b-5">Goal for {month || '…'}</h2>
              {current ? (
                <p className="text-sm text-muted-foreground" data-nexen-id="nx-89b6658b-6">Status: {current.goal.status}</p>
              ) : (
                <p className="text-sm text-muted-foreground" data-nexen-id="nx-89b6658b-7">No goal set for this month.</p>
              )}
            </div>
            {current && !monthEnded && (
              <button
                type="button"
                onClick={() => removeGoal(current.goal.id)}
                className="rounded-[var(--radius)] border px-3 py-1 text-sm text-destructive"
               data-nexen-id="nx-89b6658b-8">
                Delete goal
              </button>
            )}
          </div>

          {current && (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-3xl font-bold" data-nexen-id="nx-89b6658b-9">
                  {completed} / {targetCount}
                </span>
                <span className="text-sm text-muted-foreground" data-nexen-id="nx-89b6658b-10">
                  {Math.round(current.progress_percent)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, current.progress_percent)}%` }}
                />
              </div>
            </>
          )}

          <p className="rounded-[var(--radius)] border bg-background p-3 text-sm" data-nexen-id="nx-89b6658b-11">{guidance}</p>

          {monthEnded && (
            <p className="text-sm text-muted-foreground" data-nexen-id="nx-89b6658b-12">
              This month has ended. Its result is read-only.
            </p>
          )}

          <form onSubmit={saveGoal} className="flex flex-col gap-3" data-nexen-id="nx-89b6658b-13">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1 text-sm" data-nexen-id="nx-89b6658b-14">
                Month
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full max-w-full rounded-[var(--radius)] border bg-background px-3 py-2"
                 data-nexen-id="nx-89b6658b-15"/>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm" data-nexen-id="nx-89b6658b-16">
                Target projects
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={current ? String(targetCount) : '1–50'}
                  className="w-full max-w-full rounded-[var(--radius)] border bg-background px-3 py-2"
                 data-nexen-id="nx-89b6658b-17"/>
              </label>
            </div>
            {formError && <p className="text-sm text-destructive" data-nexen-id="nx-89b6658b-18">{formError}</p>}
            <button
              type="submit"
              disabled={monthEnded || isSaving}
              className="w-full rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
             data-nexen-id="nx-89b6658b-19">
              {isSaving ? 'Saving…' : current ? 'Update target' : 'Set goal'}
            </button>
          </form>
        </section>

        <section className="min-w-0 space-y-4 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-89b6658b-20">
          <h2 className="text-lg font-semibold" data-nexen-id="nx-89b6658b-21">Workload by week</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground" data-nexen-id="nx-89b6658b-22">Loading…</p>
          ) : workload.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-nexen-id="nx-89b6658b-23">No workload data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" data-nexen-id="nx-89b6658b-24">
                <thead className="text-muted-foreground" data-nexen-id="nx-89b6658b-25">
                  <tr data-nexen-id="nx-89b6658b-26">
                    <th className="py-2 pr-3 font-medium" data-nexen-id="nx-89b6658b-27">Week</th>
                    <th className="py-2 pr-3 font-medium" data-nexen-id="nx-89b6658b-28">Workload</th>
                    <th className="py-2 pr-3 font-medium" data-nexen-id="nx-89b6658b-29">Capacity h</th>
                    <th className="py-2 pr-3 font-medium" data-nexen-id="nx-89b6658b-30">Open tasks</th>
                    <th className="py-2 font-medium" data-nexen-id="nx-89b6658b-31">Active projects</th>
                  </tr>
                </thead>
                <tbody data-nexen-id="nx-89b6658b-32">
                  {workload.map((w) => (
                    <tr key={w.week_start} className="border-t" data-nexen-id="nx-89b6658b-33">
                      <td className="py-2 pr-3" data-nexen-id="nx-89b6658b-34">{w.week_start}</td>
                      <td className="py-2 pr-3" data-nexen-id="nx-89b6658b-35">{Math.round(w.workload_percent)}%</td>
                      <td className="py-2 pr-3" data-nexen-id="nx-89b6658b-36">{w.capacity_hours}</td>
                      <td className="py-2 pr-3" data-nexen-id="nx-89b6658b-37">{w.open_task_count}</td>
                      <td className="py-2" data-nexen-id="nx-89b6658b-38">{w.active_project_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}