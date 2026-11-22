'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AlertList from '@/components/AlertList';
import { useAuth } from '@/lib/auth';
import {
  createAdminInsightComplete,
  createAdminInsightDismiss,
  createAdminInsightGenerate,
  getAdminInsights,
} from '@/lib/api';
import type { Insight } from '@/types/insight';

const OWNER_ROLE = 'small_video_editing_business_owner';

const TYPE_ORDER: Record<string, number> = {
  alert: 0,
  growth_insight: 1,
  business_advice: 2,
  next_action: 3,
};
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const TYPE_LABEL: Record<string, string> = {
  business_advice: 'Business advice',
  growth_insight: 'Growth insight',
  next_action: 'Next action',
  alert: 'Alert',
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

export default function InsightsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const isOwner = user?.role === OWNER_ROLE;

  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await getAdminInsights();
      setInsights(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!loading && isAuthenticated && isOwner) void load();
  }, [loading, isAuthenticated, isOwner, load]);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      await createAdminInsightGenerate({});
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(insightId: string, action: 'dismiss' | 'complete') {
    setError(null);
    try {
      if (action === 'dismiss') await createAdminInsightDismiss(insightId, {});
      else await createAdminInsightComplete(insightId, {});
      setInsights((prev) => (prev ? prev.filter((i) => i.id !== insightId) : prev));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading || !isAuthenticated) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-6af06169-0">Loading…</p>;
  }
  if (!isOwner) {
    return (
      <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-6af06169-1">
        AI insights are not available for your role.
      </p>
    );
  }

  const visible = insights ?? null;
  const sorted = (visible ?? [])
    .slice()
    .sort(
      (a, b) =>
        (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) ||
        (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
    );
  const alerts = sorted.filter((i) => i.isAlert);
  const advice = sorted.filter((i) => !i.isAlert);

  return (
    <div data-nexen-component="nx_app_insights_page" className="mx-auto w-full max-w-4xl space-y-8 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-nexen-id="nx-6af06169-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground" data-nexen-id="nx-6af06169-3">AI business insights</h1>
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-6af06169-4">
            Advice and alerts written from your invoices, projects and expenses.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy}
          className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
         data-nexen-id="nx-6af06169-5">
          {busy ? 'Generating…' : 'Generate insights'}
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-[var(--radius)] border border-destructive bg-card p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="min-w-0 space-y-3" data-nexen-id="nx-6af06169-6">
        <h2 className="text-lg font-semibold text-foreground" data-nexen-id="nx-6af06169-7">Alerts</h2>
        <AlertList
          insights={visible === null ? null : alerts}
          limit={5}
          onDismissed={(id: string) => void handleAction(id, 'dismiss')}
        />
      </section>

      <section className="min-w-0 space-y-3" data-nexen-id="nx-6af06169-8">
        <h2 className="text-lg font-semibold text-foreground" data-nexen-id="nx-6af06169-9">Advice and growth insights</h2>
        {visible !== null && advice.length === 0 && (
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-6af06169-10">No advice right now. Generate insights to refresh.</p>
        )}
        <ul className="grid gap-3" data-nexen-id="nx-6af06169-11">
          {advice.map((insight) => (
            <li key={insight.id} className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm" data-nexen-id="nx-6af06169-12">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary" data-nexen-id="nx-6af06169-13">
                  {TYPE_LABEL[insight.type] ?? insight.type}
                </span>
                <span className="text-muted-foreground" data-nexen-id="nx-6af06169-14">{insight.priority} priority</span>
              </div>
              <h3 className="mt-2 break-words text-base font-semibold text-foreground" data-nexen-id="nx-6af06169-15">{insight.title}</h3>
              <p className="mt-1 break-words text-sm text-muted-foreground" data-nexen-id="nx-6af06169-16">{insight.body}</p>
              {insight.recommendedAction && (
                <p className="mt-2 break-words text-sm text-foreground" data-nexen-id="nx-6af06169-17">
                  <span className="font-medium" data-nexen-id="nx-6af06169-18">Next step: </span>
                  {insight.recommendedAction}
                </p>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {insight.invoiceId && (
                  <Link href={`/invoices/${insight.invoiceId}`} className="text-sm text-accent underline" data-nexen-id="nx-6af06169-19">
                    View invoice
                  </Link>
                )}
                {insight.projectId && (
                  <Link href={`/projects/${insight.projectId}`} className="text-sm text-accent underline" data-nexen-id="nx-6af06169-20">
                    View project
                  </Link>
                )}
                <div className="flex gap-2 sm:ml-auto">
                  <button
                    type="button"
                    onClick={() => void handleAction(insight.id, 'dismiss')}
                    className="rounded-[var(--radius)] border border-border px-3 py-1.5 text-sm text-foreground"
                   data-nexen-id="nx-6af06169-21">
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAction(insight.id, 'complete')}
                    className="rounded-[var(--radius)] bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                   data-nexen-id="nx-6af06169-22">
                    Complete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}