'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AlertList from '@/components/AlertList';
import CashflowChart from '@/components/CashflowChart';
import DeadlineList from '@/components/DeadlineList';
import useCurrentUser from '@/hooks/useCurrentUser';
import type { Insight } from '@/types/insight';
import {
  createAdminInsightComplete,
  createAdminInsightDismiss,
  createMyInsightComplete,
  createMyInsightDismiss,
  getAdminDashboard,
  getMyDashboard,
  getMyNextActions,
} from '@/lib/api';

type Dashboard = Awaited<ReturnType<typeof getMyDashboard>>;
type InsightAction = 'dismiss' | 'complete';

const FEATURE_LINKS = [
  { href: '/projects', label: 'Projects' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/outstanding-payments', label: 'Outstanding' },
  { href: '/cashflow', label: 'Cashflow' },
  { href: '/tasks-calendar', label: 'Tasks & calendar' },
  { href: '/insights', label: 'AI insights' },
];

export default function HomePage() {
  const router = useRouter();
  const { isOwner, isAuthenticated, isLoading, business } = useCurrentUser();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [nextActions, setNextActions] = useState<Insight[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!business) {
      router.replace('/business-setup');
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const data = isOwner ? await getAdminDashboard() : await getMyDashboard();
        const actions = isOwner ? data.next_steps : await getMyNextActions();
        if (!cancelled) {
          setDashboard(data);
          setNextActions(actions.slice(0, 5));
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not load your dashboard.');
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, business, isOwner, router]);

  const removeInsight = (insightId: string) => {
    setDashboard((d) =>
      d
        ? {
            ...d,
            alerts: d.alerts.filter((a) => a.id !== insightId),
            next_steps: d.next_steps.filter((n) => n.id !== insightId),
          }
        : d,
    );
    setNextActions((prev) => prev.filter((n) => n.id !== insightId));
  };

  const mutate = isOwner
    ? { dismiss: createAdminInsightDismiss, complete: createAdminInsightComplete }
    : { dismiss: createMyInsightDismiss, complete: createMyInsightComplete };

  const runAction = async (insightId: string, action: InsightAction) => {
    setActionError(null);
    try {
      await mutate[action](insightId, {});
      removeInsight(insightId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'That action could not be completed.');
    }
  };

  if (loadError) {
    return <p className="p-6 text-sm text-destructive" data-nexen-id="nx-3393394e-0">{loadError}</p>;
  }
  if (!dashboard) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-3393394e-1">Loading your dashboard…</p>;
  }

  return (
    <div data-nexen-component="nx_app_page" className="mx-auto w-full max-w-5xl min-w-0 space-y-6 p-4 sm:p-6">
      <header className="min-w-0" data-nexen-id="nx-3393394e-2">
        <h1 className="text-2xl font-bold tracking-tight" data-nexen-id="nx-3393394e-3">Dashboard</h1>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-3393394e-4">
          {isOwner ? 'Business-wide next actions, alerts and deadlines.' : 'Your next actions, alerts and deadlines.'}
        </p>
      </header>

      {actionError && <p className="text-sm text-destructive" data-nexen-id="nx-3393394e-5">{actionError}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-3393394e-6">
          <h2 className="mb-3 text-lg font-semibold" data-nexen-id="nx-3393394e-7">Next actions</h2>
          {nextActions.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-nexen-id="nx-3393394e-8">No next actions right now.</p>
          ) : (
            <ul className="grid gap-3" data-nexen-id="nx-3393394e-9">
              {nextActions.map((action) => (
                <li
                  key={action.id}
                  className="flex min-w-0 flex-col gap-3 rounded-[var(--radius)] border p-3 sm:flex-row sm:items-start sm:justify-between"
                 data-nexen-id="nx-3393394e-10">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words" data-nexen-id="nx-3393394e-11">{action.title}</p>
                    <p className="text-sm text-muted-foreground break-words" data-nexen-id="nx-3393394e-12">
                      {action.recommendedAction ?? action.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void runAction(action.id, 'complete')}
                      className="rounded-[var(--radius)] border px-3 py-1.5 text-sm hover:bg-muted"
                     data-nexen-id="nx-3393394e-13">
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAction(action.id, 'dismiss')}
                      className="rounded-[var(--radius)] border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                     data-nexen-id="nx-3393394e-14">
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-3393394e-15">
          <h2 className="mb-3 text-lg font-semibold" data-nexen-id="nx-3393394e-16">Alerts</h2>
          <AlertList
            insights={dashboard.alerts}
            limit={5}
            onDismissed={(insightId: string) => void runAction(insightId, 'dismiss')}
          />
        </section>

        <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-3393394e-17">
          <h2 className="mb-3 text-lg font-semibold" data-nexen-id="nx-3393394e-18">Upcoming deadlines</h2>
          <DeadlineList deadlines={dashboard.upcoming_deadlines} dueSoonDays={7} />
        </section>

        <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-3393394e-19">
          <h2 className="mb-3 text-lg font-semibold" data-nexen-id="nx-3393394e-20">Cashflow summary</h2>
          <CashflowChart />
        </section>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Features" data-nexen-id="nx-3393394e-21">
        {FEATURE_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-[var(--radius)] border px-3 py-1.5 text-sm hover:bg-muted"
           data-nexen-id="nx-3393394e-22">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}