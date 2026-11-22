'use client';

import { useCashflowForecast } from '@/hooks/useCashflowForecast';
import type { CashflowForecast } from '@/types/cashflowforecast';

const DEFAULT_HORIZONS = [30, 60, 90];

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const toNum = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export default function CashflowChart() {
  const {
    forecasts,
    forecast,
    horizon,
    setHorizon,
    horizons,
    isLoading,
    error,
    refetch,
  } = useCashflowForecast();

  const safeForecasts: CashflowForecast[] = Array.isArray(forecasts) ? forecasts : [];
  const safeHorizons = Array.isArray(horizons) && horizons.length > 0 ? horizons : DEFAULT_HORIZONS;

  if (isLoading) {
    return (
      <div className="rounded-[var(--radius)] border bg-card p-6 shadow-sm">
        <div className="h-40 w-full animate-pulse rounded-[var(--radius)] bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[var(--radius)] border bg-card p-6 shadow-sm">
        <p className="text-sm text-destructive" data-nexen-id="nx-1db9f5d1-0">Could not load the cashflow forecast.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 inline-flex h-9 items-center rounded-[var(--radius)] border px-4 text-sm font-semibold"
         data-nexen-id="nx-1db9f5d1-1">
          Try again
        </button>
      </div>
    );
  }

  const selected: CashflowForecast | null =
    forecast ?? safeForecasts.find((f) => f.horizonDays === horizon) ?? null;

  const inflow = toNum(selected?.projectedInflow);
  const outflow = toNum(selected?.projectedOutflow);
  const net = toNum(selected?.netCashflow);
  const balance = toNum(selected?.projectedBalance);
  const shortfall = toNum(selected?.shortfallAmount);

  const detailBars = [
    { label: 'Inflow', value: inflow, tone: 'bg-primary' },
    { label: 'Outflow', value: outflow, tone: 'bg-muted' },
    { label: 'Net', value: net, tone: net < 0 ? 'bg-destructive' : 'bg-primary' },
    { label: 'Balance', value: balance, tone: balance < 0 ? 'bg-destructive' : 'bg-primary' },
  ];
  const detailMax = Math.max(1, ...detailBars.map((b) => Math.abs(b.value)));

  const horizonBalances = safeHorizons.map((h) => {
    const match = safeForecasts.find((f) => f.horizonDays === h);
    return { horizon: h, balance: toNum(match?.projectedBalance) };
  });
  const horizonMax = Math.max(1, ...horizonBalances.map((h) => Math.abs(h.balance)));

  return (
    <section className="rounded-[var(--radius)] border bg-card p-6 shadow-sm min-w-0 w-full max-w-full" data-nexen-id="nx-1db9f5d1-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-1db9f5d1-3">Projected balance</p>
          <p className="text-2xl font-bold" data-nexen-id="nx-1db9f5d1-4">{money.format(balance)}</p>
        </div>
        <div role="tablist" className="flex flex-wrap gap-2">
          {safeHorizons.map((h) => (
            <button
              key={h}
              type="button"
              role="tab"
              aria-selected={horizon === h}
              onClick={() => setHorizon(h)}
              className={`h-8 rounded-full px-3 text-xs font-semibold ${
                horizon === h
                  ? 'bg-primary text-primary-foreground'
                  : 'border text-muted-foreground'
              }`}
             data-nexen-id="nx-1db9f5d1-5">
              {h} days
            </button>
          ))}
        </div>
      </div>

      {shortfall > 0 && (
        <p className="mt-3 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive w-fit" data-nexen-id="nx-1db9f5d1-6">
          Cash shortfall of {money.format(shortfall)}
        </p>
      )}

      <div className="mt-6 flex h-40 items-end gap-3">
        {detailBars.map((bar) => {
          const pct = Math.max(2, Math.round((Math.abs(bar.value) / detailMax) * 100));
          return (
            <div key={bar.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <span className="mb-1 truncate text-center text-xs text-muted-foreground" data-nexen-id="nx-1db9f5d1-7">
                {money.format(bar.value)}
              </span>
              <div
                className={`w-full rounded-t-[calc(var(--radius)-4px)] ${bar.tone}`}
                style={{ height: `${pct}%` }}
              />
              <span className="mt-2 text-center text-xs text-muted-foreground" data-nexen-id="nx-1db9f5d1-8">{bar.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-8 border-t pt-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-1db9f5d1-9">
          Balance by horizon
        </p>
        <div className="flex h-24 items-end gap-3">
          {horizonBalances.map((h) => {
            const pct = Math.max(2, Math.round((Math.abs(h.balance) / horizonMax) * 100));
            return (
              <div data-nexen-component="nx_components_CashflowChart" key={h.horizon} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div
                  className={`w-full rounded-t-[calc(var(--radius)-4px)] ${
                    h.balance < 0 ? 'bg-destructive' : 'bg-primary/40'
                  }`}
                  style={{ height: `${pct}%` }}
                />
                <span className="mt-2 text-center text-xs text-muted-foreground" data-nexen-id="nx-1db9f5d1-10">
                  {h.horizon}d
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}