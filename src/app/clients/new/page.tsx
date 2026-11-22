'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import ClientForm from '@/components/ClientForm';

export default function NewClientPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div data-nexen-component="nx_app_clients_new_page" className="mx-auto w-full max-w-2xl min-w-0 space-y-6 px-4 py-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between" data-nexen-id="nx-c61f1d22-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground" data-nexen-id="nx-c61f1d22-1">New client</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-nexen-id="nx-c61f1d22-2">
            The client will appear in the Clients list and can be linked to projects and invoices.
          </p>
        </div>
        <Link
          href="/clients"
          className="text-sm font-medium text-primary hover:underline"
         data-nexen-id="nx-c61f1d22-3">
          Back to clients
        </Link>
      </header>

      <section className="rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-c61f1d22-4">
        <ClientForm clientId="" initialValues={{}} />
      </section>
    </div>
  );
}