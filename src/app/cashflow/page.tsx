'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CashflowChart from '@/components/CashflowChart';
import ForecastSummaryCards from '@/components/ForecastSummaryCards';
import PaymentsTable from '@/components/PaymentsTable';
import { useCashflowForecast } from '@/hooks/useCashflowForecast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  createAdminCashflowForecastGenerate,
  createMyCashflowForecastGenerate,
  getAdminPayments,
  getAdminRecurringBills,
  getMyPayments,
  getMyRecurringBills,
} from '@/lib/api';
import type { Payment } from '@/types/payment';

type BillRow = Awaited<ReturnType<typeof getMyRecurringBills>>[number];

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

function formatMoney(value: number | string, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value));
  } catch {
    return String(value);
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CashflowPage() {
  const { business, isOwner, isAuthenticated, isLoading: userLoading } = useCurrentUser();
  const { forecast, horizon, setHorizon, horizons, isLoading, error, refetch } = useCashflowForecast();

  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [bills, setBills] = useState<BillRow[] | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const currency = business?.currency ?? 'USD';

  useEffect(() => {
    if (userLoading || !isAuthenticated) return;
    let cancelled = false;
    async function load() {
      try {
        const [loadedPayments, loadedBills] = isOwner
          ? await Promise.all([getAdminPayments(), getAdminRecurringBills()])
          : await Promise.all([getMyPayments(), getMyRecurringBills()]);
        if (!cancelled) {
          setPayments(loadedPayments);
          setBills(loadedBills);
        }
      } catch (e) {
        if (!cancelled) setDataError(errorMessage(e));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userLoading, isAuthenticated, isOwner]);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      if (isOwner) {
        await createAdminCashflowForecastGenerate({});
      } else {
        await createMyCashflowForecastGenerate({});
      }
      await refetch();
    } catch (e) {
      setRefreshError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }

  if (!userLoading && !isAuthenticated) {
    return (
      <main className="mx-auto w-full max-w-5xl p-4 sm:p-6" data-nexen-id="nx-190b53f7-0">
        <p className="text-muted-foreground" data-nexen-id="nx-190b53f7-1">
          Please <Link href="/login" className="underline" data-nexen-id="nx-190b53f7-2">sign in</Link> to view your cashflow forecast.
        </p>
      </main>
    );
  }

  const upcomingInflows = (payments ?? [])
    .filter((p) => p.status === 'expected')
    .sort((a, b) => String(a.expectedDate ?? '').localeCompare(String(b.expectedDate ?? '')));

  const upcomingBills = (bills ?? [])
    .filter((b) => b.status === 'active')
    .sort((a, b) => String(a.nextDueDate ?? '').localeCompare(String(b.nextDueDate ?? '')));

  return (
    <main data-nexen-component="nx_app_cashflow_page" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6" data-nexen-id="nx-190b53f7-3">
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-nexen-id="nx-190b53f7-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" data-nexen-id="nx-190b53f7-5">Cashflow forecast</h1>
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-190b53f7-6">
            Expected inflows and bills over the next 30, 60 and 90 days.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
         data-nexen-id="nx-190b53f7-7">
          {refreshing ? 'Refreshing…' : 'Refresh forecast'}
        </button>
      </header>

      {refreshError && <p className="text-sm text-destructive" data-nexen-id="nx-190b53f7-8">{refreshError}</p>}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Forecast horizon">
        {horizons.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHorizon(h)}
            aria-pressed={h === horizon}
            className={`h-9 rounded-[var(--radius)] border px-3 text-sm font-medium ${
              h === horizon ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'
            }`}
           data-nexen-id="nx-190b53f7-9">
            {h} days
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground" data-nexen-id="nx-190b53f7-10">Loading…</p>}

      <ForecastSummaryCards forecast={forecast ?? null} currency={currency} />

      <CashflowChart />

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-190b53f7-11">
        <h2 className="mb-3 text-lg font-semibold" data-nexen-id="nx-190b53f7-12">Upcoming inflows</h2>
        <PaymentsTable payments={upcomingInflows} currency={currency} />
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-190b53f7-13">
        <h2 className="mb-3 text-lg font-semibold" data-nexen-id="nx-190b53f7-14">Upcoming bills</h2>
        {dataError && <p className="text-sm text-destructive" data-nexen-id="nx-190b53f7-15">{dataError}</p>}
        {upcomingBills.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-190b53f7-16">No active recurring bills.</p>
        ) : (
          <div className="overflow-x-auto">
            <ul className="divide-y" data-nexen-id="nx-190b53f7-17">
              {upcomingBills.map((bill) => (
                <li key={bill.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between" data-nexen-id="nx-190b53f7-18">
                  <span className="min-w-0 truncate font-medium" data-nexen-id="nx-190b53f7-19">{bill.name}</span>
                  <span className="text-sm text-muted-foreground" data-nexen-id="nx-190b53f7-20">
                    {formatMoney(bill.amount, currency)} · due {formatDate(bill.nextDueDate)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}