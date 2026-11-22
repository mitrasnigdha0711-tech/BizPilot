import Link from 'next/link';
import type { Client } from '@/types/client';

export type ClientProject = {
  id: string;
  name: string;
  deadline: string;
  status: string;
};

export type ClientListItem = Client & {
  projects?: ClientProject[] | null;
  outstandingBalance?: number | string | null;
};

interface ClientTableProps {
  clients?: ClientListItem[] | null;
  currency?: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
};

function formatMoney(value: number | string | null | undefined, currency: string): string {
  const parsed = typeof value === 'string' ? Number(value) : (value ?? 0);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

function byDeadline(a: ClientProject, b: ClientProject): number {
  return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
}

export default function ClientTable({ clients, currency = 'USD' }: ClientTableProps) {
  const rows = Array.isArray(clients) ? clients : [];

  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-card p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-foreground" data-nexen-id="nx-56b2421d-0">No clients yet</p>
        <p className="mt-1 text-sm text-muted-foreground" data-nexen-id="nx-56b2421d-1">
          Add your first client to start tracking projects and invoices.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-auto rounded-[var(--radius)] border border-border bg-card shadow-sm">
      <table className="w-full min-w-[32rem] text-left text-sm" data-nexen-id="nx-56b2421d-2">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-56b2421d-3">
          <tr data-nexen-id="nx-56b2421d-4">
            <th scope="col" className="px-4 py-3 font-semibold" data-nexen-id="nx-56b2421d-5">Client</th>
            <th scope="col" className="px-4 py-3 font-semibold" data-nexen-id="nx-56b2421d-6">Projects</th>
            <th scope="col" className="px-4 py-3 font-semibold" data-nexen-id="nx-56b2421d-7">Outstanding</th>
            <th scope="col" className="px-4 py-3 font-semibold" data-nexen-id="nx-56b2421d-8">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border" data-nexen-id="nx-56b2421d-9">
          {rows.map((client) => {
            const projects = Array.isArray(client.projects)
              ? [...client.projects].sort(byDeadline)
              : [];
            const isActive = client.status === 'active';

            return (
              <tr data-nexen-component="nx_components_ClientTable" key={client.id} className="align-top transition-colors hover:bg-muted/40" data-nexen-id="nx-56b2421d-10">
                <td className="min-w-0 px-4 py-3" data-nexen-id="nx-56b2421d-11">
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-semibold text-foreground hover:text-primary"
                   data-nexen-id="nx-56b2421d-12">
                    {client.name}
                  </Link>
                </td>
                <td className="min-w-0 px-4 py-3" data-nexen-id="nx-56b2421d-13">
                  {projects.length === 0 ? (
                    <span className="text-muted-foreground" data-nexen-id="nx-56b2421d-14">No projects</span>
                  ) : (
                    <ul className="grid gap-1" data-nexen-id="nx-56b2421d-15">
                      {projects.map((project) => (
                        <li key={project.id} className="truncate text-foreground" data-nexen-id="nx-56b2421d-16">
                          {project.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3 font-medium tabular-nums text-foreground" data-nexen-id="nx-56b2421d-17">
                  {formatMoney(client.outstandingBalance, currency)}
                </td>
                <td className="px-4 py-3" data-nexen-id="nx-56b2421d-18">
                  <span
                    className={
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
                      (isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground')
                    }
                   data-nexen-id="nx-56b2421d-19">
                    {STATUS_LABEL[client.status] ?? 'Unknown'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}