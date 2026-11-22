'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ExpenseForm from '@/components/ExpenseForm';
import useAuth from '@/lib/auth';
import { getAdminProjects, getMyProjects } from '@/lib/api';

export default function NewExpensePage() {
  const { user, loading } = useAuth();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isOwner = user?.role === 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    const request = isOwner ? getAdminProjects() : getMyProjects();
    request
      .then((list) => {
        if (cancelled) return;
        const safe = Array.isArray(list) ? list : [];
        setProjects(safe.map((p) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load your projects.');
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, isOwner]);

  return (
    <div data-nexen-component="nx_app_expenses_new_page" className="mx-auto w-full max-w-2xl min-w-0 space-y-6 px-4 py-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" data-nexen-id="nx-6a7d77a8-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground" data-nexen-id="nx-6a7d77a8-1">New expense</h1>
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-6a7d77a8-2">
            Record money already spent so it appears in your expenses list.
          </p>
        </div>
        <Link
          href="/expenses"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
         data-nexen-id="nx-6a7d77a8-3">
          Back to expenses
        </Link>
      </header>

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-6a7d77a8-4">
        {loadError && (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {loadError}
          </div>
        )}
        <ExpenseForm projects={projects} />
      </section>

      <p className="text-sm text-muted-foreground" data-nexen-id="nx-6a7d77a8-5">
        Does this repeat?{' '}
        <Link
          href="/recurring-bills/new"
          className="font-medium text-foreground underline-offset-4 hover:underline"
         data-nexen-id="nx-6a7d77a8-6">
          Set up a recurring bill
        </Link>
      </p>
    </div>
  );
}