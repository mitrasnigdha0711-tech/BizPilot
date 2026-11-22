'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import InvoicesTable from '@/components/InvoicesTable';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  getAdminClients,
  getAdminInvoices,
  getAdminProjects,
  getMyClients,
  getMyInvoices,
  getMyProjects,
} from '@/lib/api';
import type { Client } from '@/types/client';
import type { Invoice } from '@/types/invoice';
import type { Project } from '@/types/project';

function isOverdue(invoice: Invoice): boolean {
  if (invoice.status === 'overdue') return true;
  return Number(invoice.balanceDue) > 0 && new Date(invoice.dueDate).getTime() < Date.now();
}

export default function InvoicesPage() {
  const router = useRouter();
  const { isOwner, business, isAuthenticated, isLoading: userLoading } = useCurrentUser();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const [invoiceList, clientList, projectList] = await Promise.all([
        isOwner ? getAdminInvoices() : getMyInvoices(),
        isOwner ? getAdminClients() : getMyClients(),
        isOwner ? getAdminProjects() : getMyProjects(),
      ]);
      setInvoices(Array.isArray(invoiceList) ? invoiceList : []);
      setClients(Array.isArray(clientList) ? clientList : []);
      setProjects(Array.isArray(projectList) ? projectList : []);
    } catch {
      setError('Invoices could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (!userLoading && !isAuthenticated) router.replace('/login');
  }, [userLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  const clientNames = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );
  const projectNames = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const rows = useMemo(() => {
    return [...invoices]
      .map((inv) => ({
        ...inv,
        clientName: clientNames.get(inv.clientId) ?? '—',
        projectName: inv.projectId ? projectNames.get(inv.projectId) ?? '—' : '—',
      }))
      .sort(
        (a, b) =>
          Number(isOverdue(b)) - Number(isOverdue(a)) ||
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
  }, [invoices, clientNames, projectNames]);

  const currency = business?.currency ?? 'USD';

  if (userLoading || !isAuthenticated) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-a5b56746-0">Loading…</p>;
  }

  return (
    <div data-nexen-component="nx_app_invoices_page" className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-nexen-id="nx-a5b56746-1">
        <h1 className="text-2xl font-bold text-foreground" data-nexen-id="nx-a5b56746-2">Invoices</h1>
        <Link
          href="/invoices/new"
          className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius)] bg-primary px-5 text-sm font-semibold text-primary-foreground sm:w-auto"
         data-nexen-id="nx-a5b56746-3">
          New invoice
        </Link>
      </header>

      {isLoading && (
        <p className="rounded-[var(--radius)] border border-border bg-card p-6 text-sm text-muted-foreground" data-nexen-id="nx-a5b56746-4">
          Loading invoices…
        </p>
      )}

      {!isLoading && error && (
        <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive" data-nexen-id="nx-a5b56746-5">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="h-9 rounded-[var(--radius)] border border-border px-4 text-sm font-medium text-foreground"
           data-nexen-id="nx-a5b56746-6">
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card shadow-sm">
          <InvoicesTable
            invoices={rows}
            currency={currency}
            emptyMessage="No invoices yet. Create your first invoice to start billing clients."
          />
        </div>
      )}
    </div>
  );
}