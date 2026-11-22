'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ClientTable from '@/components/ClientTable';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getAdminClients, getMyClients } from '@/lib/api';

type ClientRow = Awaited<ReturnType<typeof getMyClients>>[number];

export default function ClientsPage() {
  const router = useRouter();
  const { isOwner, isFreelancer, isAuthenticated, isLoading: userLoading, business } =
    useCurrentUser();
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (userLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!isOwner && !isFreelancer) {
      setLoading(false);
      setError('Clients are not available for your role.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request = isOwner ? getAdminClients() : getMyClients();
    request
      .then((data) => {
        if (!cancelled) setClients(data);
      })
      .catch(() => {
        if (!cancelled) setError('The clients could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userLoading, isAuthenticated, isOwner, isFreelancer, attempt, router]);

  const currency = business?.currency ?? 'USD';

  return (
    <section data-nexen-component="nx_app_clients_page" className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8" data-nexen-id="nx-47b8a16e-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="min-w-0 text-2xl font-bold text-foreground" data-nexen-id="nx-47b8a16e-1">Clients</h1>
        <Link
          href="/clients/new"
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm"
         data-nexen-id="nx-47b8a16e-2">
          New client
        </Link>
      </div>

      {error ? (
        <div className="rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-destructive" data-nexen-id="nx-47b8a16e-3">{error}</p>
          {(isOwner || isFreelancer) && (
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-3 inline-flex h-9 items-center rounded-[var(--radius)] border border-border px-3 text-sm font-semibold text-foreground"
             data-nexen-id="nx-47b8a16e-4">
              Try again
            </button>
          )}
        </div>
      ) : loading || userLoading ? (
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-47b8a16e-5">Loading clients…</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card shadow-sm">
          <ClientTable clients={clients} currency={currency} />
        </div>
      )}
    </section>
  );
}