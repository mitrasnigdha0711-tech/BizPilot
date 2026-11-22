
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Project } from '@/types/project';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.filter((o) => o.value !== 'all').map((o) => [o.value, o.label]),
);

const CLOSED_STATUSES = ['completed', 'cancelled'];
const DAY_MS = 86400000;

function dayDiff(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;
}

export default function ProjectsTable({ projects }: { projects?: Project[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [today, setToday] = useState<string | null>(null);

  // Computed after mount so server and client HTML match.
  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-CA'));
  }, []);

  const visible = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    const q = query.trim().toLowerCase();
    return list
      .filter((p) => status === 'all' || p.status === status)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.client?.name ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const aClosed = CLOSED_STATUSES.includes(a.status) ? 1 : 0;
        const bClosed = CLOSED_STATUSES.includes(b.status) ? 1 : 0;
        if (aClosed !== bClosed) return aClosed - bClosed;
        return a.deadline.slice(0, 10).localeCompare(b.deadline.slice(0, 10));
      });
  }, [projects, query, status]);

  const total = Array.isArray(projects) ? projects.length : 0;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by project or client"
          aria-label="Search projects"
          className="h-10 w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground sm:max-w-xs"
         data-nexen-id="nx-1dcf5707-0"/>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="h-10 w-full rounded-[var(--radius)] border border-border bg-background px-3 text-sm text-foreground sm:w-48"
         data-nexen-id="nx-1dcf5707-1">
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {total === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card p-8 text-center">
          <p className="font-medium text-foreground" data-nexen-id="nx-1dcf5707-2">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground" data-nexen-id="nx-1dcf5707-3">
            Create your first project to start tracking deadlines.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-card p-8 text-center">
          <p className="font-medium text-foreground" data-nexen-id="nx-1dcf5707-4">No projects match these filters</p>
          <p className="mt-1 text-sm text-muted-foreground" data-nexen-id="nx-1dcf5707-5">Try another status or search term.</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <ul className="flex min-w-0 flex-col gap-2" data-nexen-id="nx-1dcf5707-6">
            {visible.map((p) => {
              const deadline = p.deadline.slice(0, 10);
              const open = !CLOSED_STATUSES.includes(p.status);
              const days = today ? dayDiff(today, deadline) : null;
              const isOverdue = open && days !== null && days < 0;
              const isDueSoon = open && days !== null && days >= 0 && days <= 7;

              return (
                <li data-nexen-component="nx_components_ProjectsTable" key={p.id} data-nexen-id="nx-1dcf5707-7">
                  <Link
                    href={`/projects/${p.id}`}
                    className="bp-glass flex min-w-0 flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                   data-nexen-id="nx-1dcf5707-8">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground" data-nexen-id="nx-1dcf5707-9">{p.name}</p>
                      <p className="truncate text-sm text-muted-foreground" data-nexen-id="nx-1dcf5707-10">
                        {p.client?.name ?? 'No client'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary" data-nexen-id="nx-1dcf5707-11">
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                      <span className="text-muted-foreground" data-nexen-id="nx-1dcf5707-12">Due {deadline}</span>
                      {isOverdue && (
                        <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive" data-nexen-id="nx-1dcf5707-13">
                          Overdue
                        </span>
                      )}
                      {!isOverdue && isDueSoon && (
                        <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent" data-nexen-id="nx-1dcf5707-14">
                          Due soon
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}