'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import InvoiceLineItemsTable from '@/components/InvoiceLineItemsTable';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { createAdminInvoice, createMyInvoice, getAdminClients, getAdminProjects, getMyClients, getMyProjects } from '@/lib/api';
import type { Client } from '@/types/client';
import type { Project } from '@/types/project';

type LineItemDraft = { description: string; quantity: number; unitPrice: number };
type FieldErrors = Partial<Record<'clientId' | 'projectId' | 'issueDate' | 'dueDate' | 'items', string>>;

const inputClass =
  'w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const labelClass = 'mb-1 block text-sm font-medium text-foreground';
const errorClass = 'mt-1 text-xs text-destructive';

export default function NewInvoicePage() {
  const router = useRouter();
  const { business, isOwner, isAuthenticated, isLoading } = useCurrentUser();
  const currency = business?.currency ?? 'USD';

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<LineItemDraft[]>([]);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    setIssueDate(new Date().toLocaleDateString('en-CA'));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [c, p] = isOwner
          ? await Promise.all([getAdminClients(), getAdminProjects()])
          : await Promise.all([getMyClients(), getMyProjects()]);
        if (!cancelled) {
          setClients(Array.isArray(c) ? c : []);
          setProjects(Array.isArray(p) ? p : []);
        }
      } catch (err) {
        if (!cancelled) setDataError(err instanceof Error ? err.message : 'Could not load clients and projects.');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isOwner]);

  const clientProjects = projects.filter((p) => p.clientId === clientId);

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!clientId) errs.clientId = 'Please select a client.';
    if (!projectId || !clientProjects.some((p) => p.id === projectId)) {
      errs.projectId = 'Please select a project for this client.';
    }
    if (!issueDate) errs.issueDate = 'Please enter a valid due date on or after the issue date.';
    if (!dueDate || (issueDate && dueDate < issueDate)) {
      errs.dueDate = 'Please enter a valid due date on or after the issue date.';
    }
    if (items.length === 0) {
      errs.items = 'Add at least one line item.';
    } else if (items.some((i) => !i.description.trim())) {
      errs.items = 'Each line item needs a description.';
    } else if (items.some((i) => !(i.quantity > 0) || !(i.unitPrice >= 0))) {
      errs.items = 'Quantity must be greater than 0 and unit price cannot be negative.';
    }
    return errs;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = { clientId, projectId, issueDate, dueDate, lineItems: items };
      const invoice = isOwner ? await createAdminInvoice(payload) : await createMyInvoice(payload);
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create the invoice.');
      setIsSubmitting(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-06b2cddf-0">Loading…</p>;
  }

  return (
    <main data-nexen-component="nx_app_invoices_new_page" className="mx-auto w-full max-w-3xl min-w-0 space-y-6 p-4 sm:p-6" data-nexen-id="nx-06b2cddf-1">
      <div>
        <h1 className="text-2xl font-semibold text-foreground" data-nexen-id="nx-06b2cddf-2">New invoice</h1>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-06b2cddf-3">Create a draft invoice for a client and project.</p>
      </div>

      {dataError && <p className="text-sm text-destructive" data-nexen-id="nx-06b2cddf-4">{dataError}</p>}

      <form onSubmit={handleSubmit} noValidate className="space-y-6" data-nexen-id="nx-06b2cddf-5">
        <section className="grid grid-cols-1 gap-4 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:grid-cols-2" data-nexen-id="nx-06b2cddf-6">
          <div className="min-w-0">
            <label htmlFor="client" className={labelClass} data-nexen-id="nx-06b2cddf-7">Client</label>
            <select
              id="client"
              className={inputClass}
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setProjectId('');
              }}
             data-nexen-id="nx-06b2cddf-8">
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {fieldErrors.clientId && <p className={errorClass} data-nexen-id="nx-06b2cddf-9">{fieldErrors.clientId}</p>}
          </div>

          <div className="min-w-0">
            <label htmlFor="project" className={labelClass} data-nexen-id="nx-06b2cddf-10">Project</label>
            <select
              id="project"
              className={inputClass}
              value={projectId}
              disabled={!clientId}
              onChange={(e) => setProjectId(e.target.value)}
             data-nexen-id="nx-06b2cddf-11">
              <option value="">{clientId ? 'Select a project' : 'Select a client first'}</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {fieldErrors.projectId && <p className={errorClass} data-nexen-id="nx-06b2cddf-12">{fieldErrors.projectId}</p>}
          </div>

          <div className="min-w-0">
            <label htmlFor="issueDate" className={labelClass} data-nexen-id="nx-06b2cddf-13">Issue date</label>
            <input
              id="issueDate"
              type="date"
              className={inputClass}
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
             data-nexen-id="nx-06b2cddf-14"/>
            {fieldErrors.issueDate && <p className={errorClass} data-nexen-id="nx-06b2cddf-15">{fieldErrors.issueDate}</p>}
          </div>

          <div className="min-w-0">
            <label htmlFor="dueDate" className={labelClass} data-nexen-id="nx-06b2cddf-16">Due date</label>
            <input
              id="dueDate"
              type="date"
              className={inputClass}
              value={dueDate}
              min={issueDate || undefined}
              onChange={(e) => setDueDate(e.target.value)}
             data-nexen-id="nx-06b2cddf-17"/>
            {fieldErrors.dueDate && <p className={errorClass} data-nexen-id="nx-06b2cddf-18">{fieldErrors.dueDate}</p>}
          </div>
        </section>

        <section className="space-y-2 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-06b2cddf-19">
          <h2 className="text-base font-semibold text-foreground" data-nexen-id="nx-06b2cddf-20">Line items</h2>
          <div className="overflow-x-auto">
            <InvoiceLineItemsTable items={items} onChange={setItems} currency={currency} />
          </div>
          {fieldErrors.items && <p className={errorClass} data-nexen-id="nx-06b2cddf-21">{fieldErrors.items}</p>}
        </section>

        {submitError && <p className="text-sm text-destructive" data-nexen-id="nx-06b2cddf-22">{submitError}</p>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/invoices"
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] border px-4 text-sm font-medium text-foreground"
           data-nexen-id="nx-06b2cddf-23">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
           data-nexen-id="nx-06b2cddf-24">
            {isSubmitting ? 'Creating…' : 'Create invoice'}
          </button>
        </div>
      </form>
    </main>
  );
}