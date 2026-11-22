'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, getAdminHealthScoreLatest, getMyHealthScoreLatest, createAdminHealthScoreRecalculate, createMyHealthScoreRecalculate } from '@/lib/api';
import { useCurrentUser } from '@/hooks/useCurrentUser';

type Latest = Awaited<ReturnType<typeof getMyHealthScoreLatest>>;

const AREAS = [
  { key: 'project_consistency', label: 'Project consistency', field: 'projectConsistencyScore', href: '/projects' },
  { key: 'payment_collection', label: 'Payment collection', field: 'paymentCollectionScore', href: '/outstanding-payments' },
  { key: 'cashflow_stability', label: 'Cashflow stability', field: 'cashflowStabilityScore', href: '/cashflow' },
  { key: 'workload', label: 'Workload', field: 'workloadScore', href: '/goals' },
  { key: 'expense_management', label: 'Expense management', field: 'expenseManagementScore', href: '/expenses' },
] as const;

export default function BusinessHealthScorePage() {
  const router = useRouter();
  const { isOwner, isFreelancer, isAuthenticated, isLoading } = useCurrentUser();
  const [score, setScore] = useState<Latest | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isOwner && !isFreelancer) return;
    setLoading(true);
    setError(null);
    try {
      const latest = isOwner ? await getAdminHealthScoreLatest() : await getMyHealthScoreLatest();
      setScore(latest);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the health score.');
    } finally {
      setLoading(false);
    }
  }, [isOwner, isFreelancer]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    void load();
  }, [isLoading, isAuthenticated, load, router]);

  async function recalculate() {
    setBusy(true);
    setError(null);
    try {
      if (isOwner) await createAdminHealthScoreRecalculate({});
      else await createMyHealthScoreRecalculate({});
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not recalculate the score.');
    } finally {
      setBusy(false);
    }
  }

  const drivers = Array.isArray(score?.drivers) ? score.drivers : [];

  return (
    <main className="mx-auto w-full max-w-4xl min-w-0 space-y-6 p-4 sm:p-6" data-nexen-id="nx-bfa69f95-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground" data-nexen-id="nx-bfa69f95-1">Business health score</h1>
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-bfa69f95-2">
            {isOwner ? 'Business-wide score and what drives each area.' : 'Your score and the area that needs attention.'}
          </p>
        </div>
        <button
          type="button"
          onClick={recalculate}
          disabled={busy || loading || (!isOwner && !isFreelancer)}
          className="w-full rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
         data-nexen-id="nx-bfa69f95-3">
          {busy ? 'Recalculating…' : 'Recalculate'}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-bfa69f95-4">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground" data-nexen-id="nx-bfa69f95-5">Loading…</p>}

      {!loading && !score && !error && (
        <p className="rounded-[var(--radius)] border border-border bg-card p-4 text-sm text-muted-foreground" data-nexen-id="nx-bfa69f95-6">
          No health score yet. Press Recalculate to create the first one.
        </p>
      )}

      {score && (
        <>
          <section className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between" data-nexen-id="nx-bfa69f95-7">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-bfa69f95-8">Overall score</p>
              <p className="text-5xl font-bold text-primary" data-nexen-id="nx-bfa69f95-9">{score.overallScore}</p>
            </div>
            <p className="text-xs text-muted-foreground" data-nexen-id="nx-bfa69f95-10">Out of 100</p>
          </section>

          <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2" data-nexen-id="nx-bfa69f95-11">
            {AREAS.map((a) => {
              const value = score[a.field];
              const reason = drivers.find((d) => d.area === a.key)?.pulled_down_by;
              return (
                <div data-nexen-component="nx_app_business_health_score_page" key={a.key} className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="min-w-0 truncate text-sm font-semibold text-foreground" data-nexen-id="nx-bfa69f95-12">{a.label}</h2>
                    <span className="shrink-0 text-lg font-bold text-foreground" data-nexen-id="nx-bfa69f95-13">{value}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground break-words" data-nexen-id="nx-bfa69f95-14">
                    {reason ? `Pulled down by: ${reason}` : 'Nothing pulling this area down.'}
                  </p>
                  <Link href={a.href} className="mt-3 inline-block text-sm font-medium text-accent hover:underline" data-nexen-id="nx-bfa69f95-15">
                    Open related screen
                  </Link>
                </div>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}