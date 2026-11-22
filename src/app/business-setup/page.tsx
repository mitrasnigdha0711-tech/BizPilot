'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  createBusiness,
  updateBusiness,
  createClient,
  createProject,
  createInvoice,
  getAdminClients,
  getMyClients,
} from '@/lib/api';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { Client } from '@/types/client';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputCls = 'w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 py-2 text-sm';
const btnCls = 'rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50';

type Errors = Record<string, string>;
type BusinessForm = {
  name: string;
  services: string;
  monthlyProjectTarget: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  currency: string;
};

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const isValidDate = (d: string) => DATE.test(d) && !Number.isNaN(Date.parse(d));

const parseServices = (s: string) =>
  s.split(',').map((x) => x.trim()).filter(Boolean);

function validateBusiness(f: BusinessForm): Errors {
  const e: Errors = {};
  const name = f.name.trim();
  if (!name) e.name = 'Please enter your business name.';
  else if (name.length < 2 || name.length > 120)
    e.name = 'Business name must be between 2 and 120 characters.';
  if (parseServices(f.services).length === 0) e.services = 'Add at least one service you offer.';
  if (!f.monthlyProjectTarget.trim())
    e.monthlyProjectTarget = 'Enter how many projects you aim to complete each month.';
  else if (!/^\d+$/.test(f.monthlyProjectTarget) || Number(f.monthlyProjectTarget) < 1 || Number(f.monthlyProjectTarget) > 100)
    e.monthlyProjectTarget = 'Monthly project target must be a whole number between 1 and 100.';
  if (!HHMM.test(f.workingHoursStart))
    e.workingHoursStart = 'Enter a start time in HH:MM format, such as 09:00.';
  if (!HHMM.test(f.workingHoursEnd))
    e.workingHoursEnd = 'Enter an end time in HH:MM format, such as 17:00.';
  if (!e.workingHoursStart && !e.workingHoursEnd && toMinutes(f.workingHoursStart) >= toMinutes(f.workingHoursEnd))
    e.workingHoursEnd = 'The end time must be later than the start time.';
  if (!CURRENCIES.includes(f.currency)) e.currency = 'Select the currency you invoice in.';
  return e;
}

const errMsg = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Please try again.');

export default function BusinessSetupPage() {
  const router = useRouter();
  const { business, businessId, isOwner, isAuthenticated, isLoading, refetch } = useCurrentUser();

  const [form, setForm] = useState<BusinessForm>({
    name: '', services: '', monthlyProjectTarget: '',
    workingHoursStart: '09:00', workingHoursEnd: '17:00', currency: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [clientForm, setClientForm] = useState({ name: '', email: '' });
  const [clientErrors, setClientErrors] = useState<Errors>({});
  const [projectForm, setProjectForm] = useState({ name: '', clientId: '', deadline: '', value: '' });
  const [projectErrors, setProjectErrors] = useState<Errors>({});
  const [invoiceForm, setInvoiceForm] = useState({ clientId: '', amount: '', issueDate: '', dueDate: '', description: '' });
  const [invoiceErrors, setInvoiceErrors] = useState<Errors>({});
  const [rowMessage, setRowMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!business) return;
    setForm({
      name: business.name ?? '',
      services: Array.isArray(business.services) ? (business.services as string[]).join(', ') : '',
      monthlyProjectTarget: String(business.monthlyProjectTarget ?? ''),
      workingHoursStart: business.workingHoursStart ?? '09:00',
      workingHoursEnd: business.workingHoursEnd ?? '17:00',
      currency: business.currency ?? '',
    });
  }, [business]);

  const loadClients = () => {
    if (!businessId) return;
    (isOwner ? getAdminClients() : getMyClients())
      .then((rows) => setClients(rows))
      .catch(() => setClients([]));
  };

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, isOwner]);

  const setField = (key: keyof BusinessForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    const errs = validateBusiness(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const input = {
        name: form.name.trim(),
        services: parseServices(form.services),
        monthlyProjectTarget: Number(form.monthlyProjectTarget),
        workingHoursStart: form.workingHoursStart,
        workingHoursEnd: form.workingHoursEnd,
        currency: form.currency,
      };
      if (businessId) await updateBusiness(businessId, input);
      else await createBusiness(input);
      await refetch();
      setSaved(true);
    } catch (err) {
      setSubmitError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Errors = {};
    if (!clientForm.name.trim()) errs.name = "Enter the client's name.";
    if (clientForm.email.trim() && !EMAIL.test(clientForm.email.trim()))
      errs.email = 'Enter a valid email address for the client.';
    setClientErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await createClient({ name: clientForm.name.trim(), email: clientForm.email.trim() || undefined });
      setClientForm({ name: '', email: '' });
      setRowMessage('Client added.');
      loadClients();
    } catch (err) {
      setRowMessage(errMsg(err));
    }
  }

  async function handleAddProject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Errors = {};
    if (!projectForm.name.trim()) errs.name = 'Enter a name for the project.';
    if (!projectForm.clientId) errs.clientId = 'Select the client for this project.';
    if (projectForm.deadline && !isValidDate(projectForm.deadline)) errs.deadline = 'Enter a valid deadline date.';
    setProjectErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await createProject({
        name: projectForm.name.trim(),
        clientId: projectForm.clientId,
        deadline: projectForm.deadline || undefined,
        value: projectForm.value ? Number(projectForm.value) : undefined,
      });
      setProjectForm({ name: '', clientId: '', deadline: '', value: '' });
      setRowMessage('Project added.');
    } catch (err) {
      setRowMessage(errMsg(err));
    }
  }

  async function handleAddInvoice(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amount = Number(invoiceForm.amount);
    const errs: Errors = {};
    if (!invoiceForm.clientId) errs.clientId = 'Select the client this invoice belongs to.';
    if (!(amount > 0)) errs.amount = 'Invoice amount must be greater than zero.';
    if (!invoiceForm.dueDate || !isValidDate(invoiceForm.dueDate)) errs.dueDate = 'Enter the invoice due date.';
    setInvoiceErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const payload = {
        clientId: invoiceForm.clientId,
        issueDate: invoiceForm.issueDate || new Date().toLocaleDateString('en-CA'),
        dueDate: invoiceForm.dueDate,
        line_items: [{ description: invoiceForm.description.trim() || 'Services', quantity: 1, unit_price: amount }],
      };
      await createInvoice(payload);
      setInvoiceForm({ clientId: '', amount: '', issueDate: '', dueDate: '', description: '' });
      setRowMessage('Invoice added.');
    } catch (err) {
      setRowMessage(errMsg(err));
    }
  }

  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-9f5a51c1-0">Loading…</p>;
  }

  return (
    <main data-nexen-component="nx_app_business_setup_page" className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6" data-nexen-id="nx-9f5a51c1-1">
      <header className="space-y-1" data-nexen-id="nx-9f5a51c1-2">
        <h1 className="text-2xl font-bold" data-nexen-id="nx-9f5a51c1-3">Business setup</h1>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-9f5a51c1-4">
          Save your business profile to unlock the dashboard, then add existing clients, projects and invoices.
        </p>
      </header>

      <form onSubmit={handleSave} noValidate className="space-y-4 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-9f5a51c1-5">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="bname" data-nexen-id="nx-9f5a51c1-6">Business name</label>
          <input id="bname" className={inputCls} value={form.name} onChange={setField('name')}  data-nexen-id="nx-9f5a51c1-7"/>
          {errors.name && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-8">{errors.name}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="services" data-nexen-id="nx-9f5a51c1-9">Services (comma-separated)</label>
          <input id="services" className={inputCls} value={form.services} onChange={setField('services')} placeholder="Video editing, Colour grading"  data-nexen-id="nx-9f5a51c1-10"/>
          {errors.services && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-11">{errors.services}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="target" data-nexen-id="nx-9f5a51c1-12">Monthly project target</label>
          <input id="target" inputMode="numeric" className={inputCls} value={form.monthlyProjectTarget} onChange={setField('monthlyProjectTarget')}  data-nexen-id="nx-9f5a51c1-13"/>
          {errors.monthlyProjectTarget && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-14">{errors.monthlyProjectTarget}</p>}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="min-w-0 flex-1 space-y-1">
            <label className="text-sm font-medium" htmlFor="start" data-nexen-id="nx-9f5a51c1-15">Working hours start</label>
            <input id="start" className={inputCls} value={form.workingHoursStart} onChange={setField('workingHoursStart')}  data-nexen-id="nx-9f5a51c1-16"/>
            {errors.workingHoursStart && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-17">{errors.workingHoursStart}</p>}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <label className="text-sm font-medium" htmlFor="end" data-nexen-id="nx-9f5a51c1-18">Working hours end</label>
            <input id="end" className={inputCls} value={form.workingHoursEnd} onChange={setField('workingHoursEnd')}  data-nexen-id="nx-9f5a51c1-19"/>
            {errors.workingHoursEnd && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-20">{errors.workingHoursEnd}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="currency" data-nexen-id="nx-9f5a51c1-21">Currency</label>
          <select id="currency" className={inputCls} value={form.currency} onChange={setField('currency')} data-nexen-id="nx-9f5a51c1-22">
            <option value="">Select a currency</option>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.currency && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-23">{errors.currency}</p>}
        </div>

        {submitError && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-24">{submitError}</p>}
        {saved && (
          <p className="text-sm text-success" data-nexen-id="nx-9f5a51c1-25">
            Saved. Your dashboard is now available. <a className="underline" href="/" data-nexen-id="nx-9f5a51c1-26">Go to dashboard</a>
          </p>
        )}
        <button type="submit" disabled={saving} className={btnCls} data-nexen-id="nx-9f5a51c1-27">
          {saving ? 'Saving…' : businessId ? 'Save changes' : 'Save business'}
        </button>
      </form>

      {businessId && (
        <section className="space-y-6" data-nexen-id="nx-9f5a51c1-28">
          {rowMessage && <p className="text-sm text-muted-foreground" data-nexen-id="nx-9f5a51c1-29">{rowMessage}</p>}

          <form onSubmit={handleAddClient} noValidate className="space-y-3 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-9f5a51c1-30">
            <h2 className="text-lg font-semibold" data-nexen-id="nx-9f5a51c1-31">Add an existing client</h2>
            <input className={inputCls} placeholder="Client name" value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}  data-nexen-id="nx-9f5a51c1-32"/>
            {clientErrors.name && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-33">{clientErrors.name}</p>}
            <input className={inputCls} placeholder="Email (optional)" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}  data-nexen-id="nx-9f5a51c1-34"/>
            {clientErrors.email && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-35">{clientErrors.email}</p>}
            <button type="submit" className={btnCls} data-nexen-id="nx-9f5a51c1-36">Add client</button>
          </form>

          <form onSubmit={handleAddProject} noValidate className="space-y-3 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-9f5a51c1-37">
            <h2 className="text-lg font-semibold" data-nexen-id="nx-9f5a51c1-38">Add an existing project</h2>
            <input className={inputCls} placeholder="Project name" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}  data-nexen-id="nx-9f5a51c1-39"/>
            {projectErrors.name && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-40">{projectErrors.name}</p>}
            <select className={inputCls} value={projectForm.clientId} onChange={(e) => setProjectForm({ ...projectForm, clientId: e.target.value })} data-nexen-id="nx-9f5a51c1-41">
              <option value="">Select a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {projectErrors.clientId && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-42">{projectErrors.clientId}</p>}
            <div className="flex flex-col gap-3 sm:flex-row">
              <input type="date" className={inputCls} value={projectForm.deadline} onChange={(e) => setProjectForm({ ...projectForm, deadline: e.target.value })}  data-nexen-id="nx-9f5a51c1-43"/>
              <input inputMode="decimal" className={inputCls} placeholder="Value" value={projectForm.value} onChange={(e) => setProjectForm({ ...projectForm, value: e.target.value })}  data-nexen-id="nx-9f5a51c1-44"/>
            </div>
            {projectErrors.deadline && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-45">{projectErrors.deadline}</p>}
            <button type="submit" className={btnCls} data-nexen-id="nx-9f5a51c1-46">Add project</button>
          </form>

          <form onSubmit={handleAddInvoice} noValidate className="space-y-3 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-9f5a51c1-47">
            <h2 className="text-lg font-semibold" data-nexen-id="nx-9f5a51c1-48">Add an existing invoice</h2>
            <select className={inputCls} value={invoiceForm.clientId} onChange={(e) => setInvoiceForm({ ...invoiceForm, clientId: e.target.value })} data-nexen-id="nx-9f5a51c1-49">
              <option value="">Select a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {invoiceErrors.clientId && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-50">{invoiceErrors.clientId}</p>}
            <input className={inputCls} placeholder="Description" value={invoiceForm.description} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}  data-nexen-id="nx-9f5a51c1-51"/>
            <input inputMode="decimal" className={inputCls} placeholder={`Amount${form.currency ? ` (${form.currency})` : ''}`} value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}  data-nexen-id="nx-9f5a51c1-52"/>
            {invoiceErrors.amount && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-53">{invoiceErrors.amount}</p>}
            <div className="flex flex-col gap-3 sm:flex-row">
              <input type="date" aria-label="Issue date" className={inputCls} value={invoiceForm.issueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })}  data-nexen-id="nx-9f5a51c1-54"/>
              <input type="date" aria-label="Due date" className={inputCls} value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}  data-nexen-id="nx-9f5a51c1-55"/>
            </div>
            {invoiceErrors.dueDate && <p className="text-sm text-destructive" data-nexen-id="nx-9f5a51c1-56">{invoiceErrors.dueDate}</p>}
            <button type="submit" className={btnCls} data-nexen-id="nx-9f5a51c1-57">Add invoice</button>
          </form>
        </section>
      )}
    </main>
  );
}