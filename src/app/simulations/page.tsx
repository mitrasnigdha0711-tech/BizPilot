'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ScenarioForm from '@/components/ScenarioForm';
import ForecastSummaryCards from '@/components/ForecastSummaryCards';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCashflowForecast } from '@/hooks/useCashflowForecast';
import {
  createAdminSimulation,
  createAdminSimulationComplete,
  createAdminSimulationRun,
  deleteAdminSimulation,
  getAdminInvoices,
  getAdminSimulations,
  updateAdminSimulation,
} from '@/lib/api';

type InvoiceRow = Awaited<ReturnType<typeof getAdminInvoices>>[number];
type SimulationRow = Awaited<ReturnType<typeof getAdminSimulations>>[number];

const UNPAID_STATUSES = ['sent', 'overdue', 'partially_paid'];

function isUnpaid(invoice: InvoiceRow): boolean {
  return UNPAID_STATUSES.includes(String(invoice.status)) && Number(invoice.balanceDue) > 0;
}

function formatMoney(value: unknown, currency: string): string {
  const amount = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

function formatDay(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '—';
}

export default function SimulationsPage() {
  const router = useRouter();
  const { business, isOwner, isAuthenticated, isLoading: userLoading } = useCurrentUser();
  const { forecast } = useCashflowForecast();

  const [simulations, setSimulations] = useState<SimulationRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const currency = business?.currency ?? 'USD';

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sims, invs] = await Promise.all([getAdminSimulations(), getAdminInvoices()]);
      setSimulations(sims);
      setInvoices(invs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load simulations.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userLoading && !isAuthenticated) router.replace('/login');
  }, [userLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isOwner) void load();
  }, [isOwner, load]);

  if (userLoading) return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-8ddc6d80-0">Loading…</p>;
  if (!isAuthenticated) return null;
  if (!isOwner) {
    return (
      <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-8ddc6d80-1">
        Simulations are not available for your role.
      </p>
    );
  }

  const unpaidInvoices = invoices.filter(isUnpaid);
  const selected = simulations.find((s) => s.id === selectedId) ?? null;

  async function handleCreate(input: Parameters<React.ComponentProps<typeof ScenarioForm>['onSubmit']>[0]) {
    setSubmitError(null);
    const raw: Record<string, unknown> = { ...input };
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (name.length > 80) {
      setSubmitError('Simulation name must be 80 characters or fewer.');
      return;
    }
    const invoiceId = typeof raw.invoiceId === 'string' ? raw.invoiceId : '';
    const invoice = unpaidInvoices.find((i) => i.id === invoiceId);
    if (!invoice) {
      setSubmitError('Please select an unpaid invoice for this simulation.');
      return;
    }
    const delayDays = Number(raw.delayDays);
    if (!Number.isInteger(delayDays)) {
      setSubmitError('Delay days must be a whole number, such as 14 or 30.');
      return;
    }
    if (delayDays < 1 || delayDays > 180) {
      setSubmitError('Enter a whole number of delay days between 1 and 180.');
      return;
    }
    setIsSubmitting(true);
    try {
      await createAdminSimulation({
        name: name || `Delayed payment ${invoice.invoiceNumber}`,
        scenarioType: 'delayed_payment',
        invoiceId,
        delayDays,
      });
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not save the simulation.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function runAction(id: string, action: () => Promise<unknown>) {
    setActionError(null);
    setBusyId(id);
    try {
      await action();
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function saveName(id: string) {
    const trimmed = editName.trim();
    if (trimmed.length === 0 || trimmed.length > 80) {
      setActionError('Simulation name must be 1 to 80 characters.');
      return;
    }
    await runAction(id, () => updateAdminSimulation(id, { name: trimmed }));
    setEditingId(null);
  }

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6 p-4 sm:p-6">
      <header className="min-w-0" data-nexen-id="nx-8ddc6d80-2">
        <h1 className="text-2xl font-bold" data-nexen-id="nx-8ddc6d80-3">What-if simulations</h1>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-8ddc6d80-4">
          Model delayed customer payments and see their effect on cashflow.
        </p>
      </header>

      {actionError && <p role="alert" className="text-sm text-[hsl(var(--destructive))]" data-nexen-id="nx-8ddc6d80-5">{actionError}</p>}

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-8ddc6d80-6">
          <h2 className="mb-3 text-lg font-semibold" data-nexen-id="nx-8ddc6d80-7">New scenario</h2>
          <ScenarioForm
            invoices={unpaidInvoices}
            onSubmit={handleCreate}
            isSubmitting={isSubmitting}
          />
          {submitError && <p role="alert" className="mt-2 text-sm text-[hsl(var(--destructive))]" data-nexen-id="nx-8ddc6d80-8">{submitError}</p>}
        </section>

        <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-8ddc6d80-9">
          <h2 className="mb-3 text-lg font-semibold" data-nexen-id="nx-8ddc6d80-10">Saved scenarios</h2>
          {isLoading && <p className="text-sm text-muted-foreground" data-nexen-id="nx-8ddc6d80-11">Loading…</p>}
          {error && <p role="alert" className="text-sm text-[hsl(var(--destructive))]" data-nexen-id="nx-8ddc6d80-12">{error}</p>}
          {!isLoading && !error && simulations.length === 0 && (
            <p className="text-sm text-muted-foreground" data-nexen-id="nx-8ddc6d80-13">No scenarios saved yet.</p>
          )}
          <ul className="grid gap-3" data-nexen-id="nx-8ddc6d80-14">
            {simulations.map((sim) => {
              const busy = busyId === sim.id;
              const isDraft = String(sim.status) === 'draft';
              return (
                <li data-nexen-component="nx_app_simulations_page" key={sim.id} className="min-w-0 rounded-[var(--radius)] border p-3" data-nexen-id="nx-8ddc6d80-15">
                  {editingId === sim.id ? (
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                      <input
                        className="min-w-0 flex-1 rounded-[var(--radius)] border bg-background px-2 py-1 text-sm"
                        value={editName}
                        maxLength={80}
                        onChange={(e) => setEditName(e.target.value)}
                       data-nexen-id="nx-8ddc6d80-16"/>
                      <button type="button" className="text-sm font-medium" disabled={busy} onClick={() => saveName(sim.id)} data-nexen-id="nx-8ddc6d80-17">
                        Save
                      </button>
                      <button type="button" className="text-sm text-muted-foreground" onClick={() => setEditingId(null)} data-nexen-id="nx-8ddc6d80-18">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full min-w-0 flex-col text-left"
                      onClick={() => setSelectedId(sim.id)}
                     data-nexen-id="nx-8ddc6d80-19">
                      <span className="truncate font-medium" data-nexen-id="nx-8ddc6d80-20">{sim.name}</span>
                      <span className="text-xs text-muted-foreground" data-nexen-id="nx-8ddc6d80-21">{String(sim.status)}</span>
                    </button>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    {isDraft && (
                      <button type="button" disabled={busy} onClick={() => runAction(sim.id, () => createAdminSimulationRun(sim.id, {}))} data-nexen-id="nx-8ddc6d80-22">
                        Run
                      </button>
                    )}
                    {isDraft && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(sim.id, () => createAdminSimulationComplete(sim.id, {}))}
                       data-nexen-id="nx-8ddc6d80-23">
                        Mark complete
                      </button>
                    )}
                    {isDraft && editingId !== sim.id && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditName(sim.name);
                          setEditingId(sim.id);
                        }}
                       data-nexen-id="nx-8ddc6d80-24">
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-[hsl(var(--destructive))]"
                      disabled={busy}
                      onClick={() =>
                        runAction(sim.id, async () => {
                          await deleteAdminSimulation(sim.id);
                          if (selectedId === sim.id) setSelectedId(null);
                        })
                      }
                     data-nexen-id="nx-8ddc6d80-25">
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {selected && (
        <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-8ddc6d80-26">
          <h2 className="mb-3 text-lg font-semibold" data-nexen-id="nx-8ddc6d80-27">Results: {selected.name}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <p className="text-xs uppercase text-muted-foreground" data-nexen-id="nx-8ddc6d80-28">Projected balance</p>
              <p className="text-xl font-bold" data-nexen-id="nx-8ddc6d80-29">{formatMoney(selected.projectedBalance, currency)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase text-muted-foreground" data-nexen-id="nx-8ddc6d80-30">Shortfall</p>
              <p className="text-xl font-bold" data-nexen-id="nx-8ddc6d80-31">{formatMoney(selected.shortfallAmount, currency)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase text-muted-foreground" data-nexen-id="nx-8ddc6d80-32">Projected payment date</p>
              <p className="text-xl font-bold" data-nexen-id="nx-8ddc6d80-33">{formatDay(selected.projectedPaymentDate)}</p>
            </div>
          </div>
        </section>
      )}

      <section className="min-w-0 space-y-3" data-nexen-id="nx-8ddc6d80-34">
        <h2 className="text-lg font-semibold" data-nexen-id="nx-8ddc6d80-35">Comparison with current forecast</h2>
        <ForecastSummaryCards forecast={forecast} currency={currency} />
        {selected && (
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-8ddc6d80-36">
            Scenario &quot;{selected.name}&quot; projects a balance of{' '}
            {formatMoney(selected.projectedBalance, currency)} with a shortfall of{' '}
            {formatMoney(selected.shortfallAmount, currency)}.
          </p>
        )}
      </section>
    </div>
  );
}