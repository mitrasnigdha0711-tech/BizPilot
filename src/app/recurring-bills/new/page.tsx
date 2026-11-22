
'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RecurringBillForm from '@/components/RecurringBillForm';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function NewRecurringBillPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useCurrentUser();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6" data-nexen-id="nx-38ad18a5-0">
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-38ad18a5-1">Loading…</p>
      </main>
    );
  }

  return (
    <main data-nexen-component="nx_app_recurring_bills_new_page" className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6" data-nexen-id="nx-38ad18a5-2">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" data-nexen-id="nx-38ad18a5-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground" data-nexen-id="nx-38ad18a5-4">New recurring bill</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-nexen-id="nx-38ad18a5-5">
            This bill will repeat on the schedule you set here.
          </p>
        </div>
        <Link
          href="/recurring-bills"
          className="shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground"
         data-nexen-id="nx-38ad18a5-6">
          Back to recurring bills
        </Link>
      </header>

      <section className="w-full rounded-[var(--radius)] border border-border bg-card/60 p-4 shadow-sm backdrop-blur sm:p-6" data-nexen-id="nx-38ad18a5-7">
        <RecurringBillForm />
      </section>
    </main>
  );
}