'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  getAdminClientById,
  getAdminPayments,
  getMyClientById,
  getMyPayments,
} from '@/lib/api';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import ClientForm from '@/components/ClientForm';
import InvoicesTable from '@/components/InvoicesTable';
import PaymentsTable from '@/components/PaymentsTable';

type ClientDetail = Awaited<ReturnType<typeof getMyClientById>>;
type PaymentList = Awaited<ReturnType<typeof getMyPayments>>;

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const router = useRouter();
  const { business, isOwner, isFreelancer, isAuthenticated, isLoading: authLoading } =
    useCurrentUser();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [payments, setPayments] = useState<PaymentList>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const data = isOwner ? await getAdminClientById(id) : await getMyClientById(id);
      const paid = isOwner
        ? await getAdminPayments({ clientId: id })
        : await getMyPayments({ clientId: id });
      setClient(data);
      setPayments(paid);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load this client.');
    } finally {
      setIsFetching(false);
    }
  }, [id, isOwner]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (isOwner || isFreelancer) void load();
  }, [authLoading, isAuthenticated, isOwner, isFreelancer, load, router]);

  if (authLoading || (isFetching && !client && !error)) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-1cb5e390-0">Loading…</p>;
  }
  if (!isOwner && !isFreelancer) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-1cb5e390-1">This client is not available for your role.</p>;
  }
  if (error) {
    return <p className="p-6 text-sm text-destructive" data-nexen-id="nx-1cb5e390-2">{error}</p>;
  }
  if (!client) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-1cb5e390-3">Client not found.</p>;
  }

  const currency = business?.currency ?? 'USD';
  const invoices = client.invoices ?? [];
  const projects = [...(client.projects ?? [])].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
  );
  const outstanding = invoices
    .filter((inv) => inv.status !== 'paid')
    .reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
  const today = new Date();
  const hasOverdue = invoices.some(
    (inv) => Number(inv.balanceDue) > 0 && new Date(inv.dueDate) < today,
  );

  return (
    <div data-nexen-component="nx_app_clients__id__page" className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link href="/clients" className="text-sm text-muted-foreground hover:underline" data-nexen-id="nx-1cb5e390-4">
            ← Back to clients
          </Link>
          <h1 className="mt-1 truncate text-2xl font-bold" data-nexen-id="nx-1cb5e390-5">{client.name}</h1>
        </div>
        <span className="inline-flex w-fit rounded-full border border-border px-3 py-1 text-xs font-semibold capitalize" data-nexen-id="nx-1cb5e390-6">
          {client.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-1cb5e390-7">Outstanding balance</p>
          <p className="mt-1 text-xl font-semibold" data-nexen-id="nx-1cb5e390-8">{formatMoney(outstanding, currency)}</p>
        </div>
        <div className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-1cb5e390-9">Overdue money</p>
          <p className="mt-1 text-xl font-semibold" data-nexen-id="nx-1cb5e390-10">{hasOverdue ? 'Yes, overdue invoices' : 'None'}</p>
        </div>
      </div>

      <section className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm" data-nexen-id="nx-1cb5e390-11">
        <h2 className="mb-4 text-lg font-semibold" data-nexen-id="nx-1cb5e390-12">Contact details</h2>
        <ClientForm
          clientId={id}
          initialValues={{
            name: client.name,
            email: client.email ?? '',
            phone: client.phone ?? '',
            address: client.address ?? '',
            status: client.status,
          }}
        />
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm" data-nexen-id="nx-1cb5e390-13">
        <h2 className="mb-4 text-lg font-semibold" data-nexen-id="nx-1cb5e390-14">Projects</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-1cb5e390-15">No projects yet.</p>
        ) : (
          <ul className="grid gap-2" data-nexen-id="nx-1cb5e390-16">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex flex-col gap-1 rounded-[var(--radius)] border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
               data-nexen-id="nx-1cb5e390-17">
                <span className="min-w-0 truncate font-medium" data-nexen-id="nx-1cb5e390-18">{project.name}</span>
                <span className="text-sm capitalize text-muted-foreground" data-nexen-id="nx-1cb5e390-19">
                  {project.status} · due {new Date(project.deadline).toLocaleDateString('en-US')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm" data-nexen-id="nx-1cb5e390-20">
        <h2 className="mb-4 text-lg font-semibold" data-nexen-id="nx-1cb5e390-21">Invoices</h2>
        <InvoicesTable
          invoices={invoices}
          currency={currency}
          emptyMessage="No invoices for this client yet."
        />
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm" data-nexen-id="nx-1cb5e390-22">
        <h2 className="mb-4 text-lg font-semibold" data-nexen-id="nx-1cb5e390-23">Payment history</h2>
        <PaymentsTable payments={payments} currency={currency} />
      </section>
    </div>
  );
}