'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import ReminderDraftEditor from '@/components/ReminderDraftEditor';

export default function PaymentRemindersPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return (
      <main className="min-h-screen bg-background text-foreground" data-nexen-id="nx-678038ce-0">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-678038ce-1">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main data-nexen-component="nx_app_payment_reminders_page" className="min-h-screen bg-background text-foreground" data-nexen-id="nx-678038ce-2">
      <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="min-w-0" data-nexen-id="nx-678038ce-3">
          <h1 className="text-2xl font-bold tracking-tight" data-nexen-id="nx-678038ce-4">Payment reminders</h1>
          <p className="mt-2 text-sm text-muted-foreground" data-nexen-id="nx-678038ce-5">
            Review, edit, approve and send reminder drafts for overdue invoices.
            A draft must be approved before it can be sent to the client.
          </p>
        </header>
        <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-678038ce-6">
          <ReminderDraftEditor />
        </section>
      </div>
    </main>
  );
}