
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TaskCalendar from '@/components/TaskCalendar';
import { useAuth } from '@/lib/auth';

export default function TasksCalendarPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  return (
    <main data-nexen-component="nx_app_tasks_calendar_page" className="mx-auto w-full max-w-5xl min-w-0 space-y-6 p-4 sm:p-6" data-nexen-id="nx-ab2ba7e2-0">
      <header className="space-y-1" data-nexen-id="nx-ab2ba7e2-1">
        <h1 className="text-2xl font-bold text-foreground" data-nexen-id="nx-ab2ba7e2-2">Tasks &amp; Calendar</h1>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-ab2ba7e2-3">
          Today&apos;s tasks, project deadlines, follow-ups and upcoming bills.
        </p>
      </header>
      {isAuthenticated ? <TaskCalendar /> : null}
    </main>
  );
}