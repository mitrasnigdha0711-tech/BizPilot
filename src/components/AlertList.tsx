
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createMyInsightDismiss } from '@/lib/api';
import type { Insight } from '@/types/insight';

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

interface AlertListProps {
  insights?: Insight[] | null;
  limit?: number;
  onDismissed?: (insightId: string) => void;
}

function formatDue(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function followThroughHref(insight: Insight): { href: string; label: string } | null {
  if (insight.invoiceId) return { href: `/invoices/${insight.invoiceId}`, label: 'Open invoice' };
  if (insight.projectId) return { href: `/projects/${insight.projectId}`, label: 'Open project' };
  return null;
}

export default function AlertList({ insights, limit = 10, onDismissed }: AlertListProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const safeInsights = Array.isArray(insights) ? insights : [];

  const rows = useMemo(() => {
    return safeInsights
      .filter((i) => !hidden.has(i.id))
      .sort((a, b) => {
        if (a.isAlert !== b.isAlert) return a.isAlert ? -1 : 1;
        const pa = PRIORITY_RANK[a.priority] ?? 3;
        const pb = PRIORITY_RANK[b.priority] ?? 3;
        if (pa !== pb) return pa - pb;
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        return da - db;
      })
      .slice(0, limit);
  }, [safeInsights, hidden, limit]);

  async function dismiss(insight: Insight) {
    setPendingId(insight.id);
    setError(null);
    try {
      await createMyInsightDismiss(insight.id, {});
      setHidden((prev) => new Set(prev).add(insight.id));
      onDismissed?.(insight.id);
    } catch {
      setError('Could not dismiss this alert. Try again.');
    } finally {
      setPendingId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-nexen-id="nx-e3551df1-0">No alerts or next actions right now.</p>
    );
  }

  return (
    <div className="min-w-0">
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive" data-nexen-id="nx-e3551df1-1">
          {error}
        </p>
      )}
      <ul className="grid gap-3" data-nexen-id="nx-e3551df1-2">
        {rows.map((insight) => {
          const due = formatDue(insight.dueDate);
          const link = followThroughHref(insight);
          const isPending = pendingId === insight.id;
          return (
            <li data-nexen-component="nx_components_AlertList"
              key={insight.id}
              className="flex flex-col gap-3 rounded-[var(--radius)] border bg-card/60 p-4 backdrop-blur sm:flex-row sm:items-start"
             data-nexen-id="nx-e3551df1-3">
              <span
                aria-hidden="true"
                className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                  insight.isAlert ? 'bg-destructive' : 'bg-primary'
                }`}
               data-nexen-id="nx-e3551df1-4"/>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold" data-nexen-id="nx-e3551df1-5">{insight.title}</p>
                  {insight.isAlert && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive" data-nexen-id="nx-e3551df1-6">
                      Alert
                    </span>
                  )}
                  {due && (
                    <span className="text-xs text-muted-foreground" data-nexen-id="nx-e3551df1-7">Due {due}</span>
                  )}
                </div>
                <p className="mt-1 break-words text-sm text-muted-foreground" data-nexen-id="nx-e3551df1-8">{insight.body}</p>
                {insight.recommendedAction && (
                  <p className="mt-1 break-words text-sm text-primary" data-nexen-id="nx-e3551df1-9">
                    Next: {insight.recommendedAction}
                  </p>
                )}
                {link && (
                  <Link
                    href={link.href}
                    className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                   data-nexen-id="nx-e3551df1-10">
                    {link.label}
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(insight)}
                disabled={isPending}
                className="h-9 shrink-0 rounded-[var(--radius)] border px-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
               data-nexen-id="nx-e3551df1-11">
                {isPending ? 'Dismissing...' : 'Dismiss'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}