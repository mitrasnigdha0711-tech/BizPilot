'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getAdminCalendar,
  getMyCalendar,
  createAdminTaskComplete,
  createMyTaskComplete,
} from '@/lib/api';
import { useCurrentUser } from '@/hooks/useCurrentUser';

type CalendarItem = {
  kind: string;
  id: string;
  title: string;
  date: string;
  status: string;
};

const WINDOW_DAYS = 14;
const UPCOMING_DAYS = 7;

const KIND_LABELS: Record<string, string> = {
  task: 'Task',
  follow_up: 'Follow-up',
  project_deadline: 'Deadline',
  recurring_bill: 'Bill',
  invoice_due: 'Invoice due',
};

const KIND_CLASSES: Record<string, string> = {
  task: 'border-accent/40 bg-accent/10 text-accent',
  follow_up: 'border-secondary/40 bg-secondary/10 text-secondary',
  project_deadline: 'border-primary/40 bg-primary/10 text-primary',
  recurring_bill: 'border-muted-foreground/40 bg-muted text-muted-foreground',
  invoice_due: 'border-destructive/40 bg-destructive/10 text-destructive',
};

function addDays(day: string, n: number): string {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDay(day: string): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function TaskCalendar() {
  const { isOwner, isLoading: userLoading } = useCurrentUser();
  const [anchor, setAnchor] = useState<string>('');
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Today is computed on the client only to keep server and client HTML identical.
  useEffect(() => {
    setAnchor(new Date().toLocaleDateString('en-CA'));
  }, []);

  useEffect(() => {
    if (!anchor || userLoading) return;
    let cancelled = false;
    const query = { from: anchor, to: addDays(anchor, WINDOW_DAYS - 1) };
    setIsLoading(true);
    const request = isOwner ? getAdminCalendar(query) : getMyCalendar(query);
    request
      .then((result) => {
        if (!cancelled) {
          setItems(result);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the calendar.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [anchor, isOwner, userLoading, reloadKey]);

  const days = useMemo(
    () => (anchor ? Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(anchor, i)) : []),
    [anchor],
  );

  const safeItems = Array.isArray(items) ? items : [];

  const isOverdue = (item: CalendarItem) =>
    item.status === 'overdue' || (item.status === 'open' && item.date.slice(0, 10) < anchor);

  const isUpcomingBill = (item: CalendarItem) =>
    item.kind === 'recurring_bill' &&
    item.date.slice(0, 10) >= anchor &&
    item.date.slice(0, 10) <= addDays(anchor, UPCOMING_DAYS);

  const canComplete = (item: CalendarItem) =>
    (item.kind === 'task' || item.kind === 'follow_up') && item.status === 'open';

  const completeItem = async (item: CalendarItem) => {
    try {
      if (isOwner) await createAdminTaskComplete(item.id, {});
      else await createMyTaskComplete(item.id, {});
      setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not mark this task as completed.');
    }
  };

  return (
    <section className="w-full min-w-0 rounded-[var(--radius)] border border-border bg-card/60 p-4 shadow-sm backdrop-blur" data-nexen-id="nx-23a18e2c-0">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground" data-nexen-id="nx-23a18e2c-1">Tasks &amp; Calendar</h2>
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-23a18e2c-2">
            Tasks, deadlines, bills and invoice due dates for the next {WINDOW_DAYS} days.
          </p>
        </div>
        {isLoading && <span className="text-xs text-muted-foreground" data-nexen-id="nx-23a18e2c-3">Loading…</span>}
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!anchor ? null : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((day) => {
            const dayItems = safeItems.filter((item) => item.date.slice(0, 10) === day);
            return (
              <div
                key={day}
                className={`flex min-w-0 flex-col gap-2 rounded-[var(--radius)] border p-3 ${
                  day === anchor ? 'border-primary/60 bg-primary/5' : 'border-border bg-background/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground" data-nexen-id="nx-23a18e2c-4">{formatDay(day)}</span>
                  {day === anchor && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary" data-nexen-id="nx-23a18e2c-5">Today</span>
                  )}
                </div>

                {dayItems.length === 0 && <p className="text-xs text-muted-foreground" data-nexen-id="nx-23a18e2c-6">Nothing scheduled</p>}

                {dayItems.map((item) => {
                  const overdue = isOverdue(item);
                  const upcoming = isUpcomingBill(item);
                  return (
                    <div data-nexen-component="nx_components_TaskCalendar"
                      key={`${item.kind}-${item.id}`}
                      className={`flex min-w-0 flex-col gap-1 rounded-[var(--radius)] border p-2 ${
                        KIND_CLASSES[item.kind] ?? 'border-border bg-muted text-muted-foreground'
                      } ${overdue ? 'ring-1 ring-destructive' : ''}`}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wide" data-nexen-id="nx-23a18e2c-7">
                        {KIND_LABELS[item.kind] ?? item.kind}
                        {overdue && <span className="ml-1 text-destructive" data-nexen-id="nx-23a18e2c-8">· Overdue</span>}
                        {upcoming && <span className="ml-1 text-accent" data-nexen-id="nx-23a18e2c-9">· Upcoming</span>}
                      </span>
                      <span className="truncate text-sm text-foreground" title={item.title} data-nexen-id="nx-23a18e2c-10">
                        {item.title}
                      </span>
                      {canComplete(item) && (
                        <button
                          type="button"
                          onClick={() => completeItem(item)}
                          className="self-start rounded-[var(--radius)] border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                         data-nexen-id="nx-23a18e2c-11">
                          Mark done
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}