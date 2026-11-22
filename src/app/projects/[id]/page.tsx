'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProjectForm from '@/components/ProjectForm';
import InvoicesTable from '@/components/InvoicesTable';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  getMyProjectById, getAdminProjectById, updateMyProject, updateAdminProject,
  createMyProjectComplete, createAdminProjectComplete,
  createMyProjectCancel, createAdminProjectCancel,
  getMyClients, getAdminClients, getMyTasks, getAdminTasks, createTask,
  getMyInvoices, getAdminInvoices, updateMyInvoice, updateAdminInvoice,
  updateAdminTask, getAdminUsers,
} from '@/lib/api';
import type { Project } from '@/types/project';
import type { Client } from '@/types/client';
import type { Invoice } from '@/types/invoice';
import type { Task } from '@/types/task';
import type { User } from '@/types/user';

type ProjectDetail = Project & { client: Client; invoices: Invoice[] };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const { business, isOwner, isAuthenticated, isLoading: userLoading } = useCurrentUser();
  const currency = business?.currency ?? 'USD';

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [pickedInvoiceId, setPickedInvoiceId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskError, setTaskError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && !isAuthenticated) router.replace('/login');
  }, [userLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    try {
      const [p, c, t, i] = await Promise.all([
        isOwner ? getAdminProjectById(projectId) : getMyProjectById(projectId),
        isOwner ? getAdminClients() : getMyClients(),
        isOwner ? getAdminTasks() : getMyTasks(),
        isOwner ? getAdminInvoices() : getMyInvoices(),
      ]);
      setProject(p);
      setClients(c);
      setTasks(t);
      setInvoices(i);
      if (isOwner) setTeam(await getAdminUsers());
      setLoadError(null);
    } catch (e) {
      setLoadError(errMsg(e));
    }
  }, [isOwner, projectId]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load, loadKey]);

  const reload = () => setLoadKey((k) => k + 1);
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const linkedInvoices = invoices.filter((i) => i.projectId === projectId);
  const pickable = invoices.filter((i) => project && i.clientId === project.clientId && !i.projectId);
  const activeTeam = team.filter((u) => u.isActive);
  const todayStr = new Date().toLocaleDateString('en-CA');
  const isOverdue = !!project && project.status !== 'completed' && String(project.deadline).slice(0, 10) < todayStr;

  async function saveProject(values: { name: string; clientId: string; deadline: string; value: string | number }) {
    setSaveError(null);
    const valueNum = Number(values.value);
    if (!values.clientId) return setSaveError('Please select a client for this project.');
    if (!values.deadline) return setSaveError('Please choose a deadline today or later.');
    if (project && values.deadline !== String(project.deadline).slice(0, 10) && values.deadline < todayStr) {
      return setSaveError('Please choose a deadline today or later.');
    }
    if (project?.startDate && values.deadline < String(project.startDate).slice(0, 10)) {
      return setSaveError('Enter a deadline on or after the project start date.');
    }
    if (values.value === '' || Number.isNaN(valueNum) || valueNum < 0) {
      return setSaveError('Please enter a project value of 0 or more.');
    }
    setIsSaving(true);
    try {
      const body = { name: values.name, clientId: values.clientId, deadline: values.deadline, value: valueNum };
      if (isOwner) await updateAdminProject(projectId, body);
      else await updateMyProject(projectId, body);
      reload();
    } catch (e) {
      setSaveError(errMsg(e));
    } finally {
      setIsSaving(false);
    }
  }

  async function changeStatus(action: 'complete' | 'cancel') {
    setActionError(null);
    try {
      if (action === 'complete') {
        if (isOwner) await createAdminProjectComplete(projectId, {});
        else await createMyProjectComplete(projectId, {});
      } else {
        if (isOwner) await createAdminProjectCancel(projectId, {});
        else await createMyProjectCancel(projectId, {});
      }
      reload();
    } catch (e) {
      setActionError(errMsg(e));
    }
  }

  async function linkInvoice() {
    if (!pickedInvoiceId) return;
    setActionError(null);
    try {
      if (isOwner) await updateAdminInvoice(pickedInvoiceId, { projectId });
      else await updateMyInvoice(pickedInvoiceId, { projectId });
      setPickedInvoiceId('');
      reload();
    } catch (e) {
      setActionError(errMsg(e));
    }
  }

  async function addTask() {
    setTaskError(null);
    const title = taskTitle.trim();
    if (title.length < 1 || title.length > 120) return setTaskError('Enter a task title of up to 120 characters.');
    if (taskDueDate && Number.isNaN(Date.parse(taskDueDate))) return setTaskError('Enter a valid due date.');
    try {
      await createTask({ title, projectId, dueDate: taskDueDate ? new Date(taskDueDate) : null });
      setTaskTitle('');
      setTaskDueDate('');
      reload();
    } catch (e) {
      setTaskError(errMsg(e));
    }
  }

  async function assignTask(taskId: string, assigneeId: string) {
    setActionError(null);
    try {
      await updateAdminTask(taskId, { assigneeId: assigneeId || null });
      reload();
    } catch (e) {
      setActionError(errMsg(e));
    }
  }

  if (loadError) return <p className="p-6 text-sm text-[hsl(var(--destructive))]" data-nexen-id="nx-d1356e98-0">{loadError}</p>;
  if (!project) return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-d1356e98-1">Loading…</p>;

  const isClosed = project.status === 'completed' || project.status === 'cancelled';

  return (
    <div data-nexen-component="nx_app_projects__id__page" className="mx-auto w-full max-w-5xl min-w-0 space-y-6 p-4 sm:p-6">
      <header className="min-w-0 space-y-2" data-nexen-id="nx-d1356e98-2">
        <h1 className="break-words text-2xl font-bold" data-nexen-id="nx-d1356e98-3">{project.name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/clients/${project.clientId}`} className="underline" data-nexen-id="nx-d1356e98-4">{project.client?.name}</Link>
          <span className="rounded-[999px] border border-border px-2 py-0.5" data-nexen-id="nx-d1356e98-5">{project.status}</span>
          <span data-nexen-id="nx-d1356e98-6">Deadline {String(project.deadline).slice(0, 10)}</span>
          {isOverdue && <span className="rounded-[999px] bg-[hsl(var(--destructive)/0.12)] px-2 py-0.5 text-[hsl(var(--destructive))]" data-nexen-id="nx-d1356e98-7">Overdue</span>}
        </div>
        {!isClosed && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => changeStatus('complete')} className="rounded-[var(--radius)] border border-border px-3 py-1.5 text-sm" data-nexen-id="nx-d1356e98-8">Mark completed</button>
            <button type="button" onClick={() => changeStatus('cancel')} className="rounded-[var(--radius)] border border-border px-3 py-1.5 text-sm" data-nexen-id="nx-d1356e98-9">Cancel project</button>
          </div>
        )}
        {actionError && <p className="text-sm text-[hsl(var(--destructive))]" data-nexen-id="nx-d1356e98-10">{actionError}</p>}
      </header>

      <section className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm" data-nexen-id="nx-d1356e98-11">
        <h2 className="mb-3 font-semibold" data-nexen-id="nx-d1356e98-12">Edit project</h2>
        <ProjectForm
          clients={clients}
          initialValues={{ name: project.name, clientId: project.clientId, deadline: String(project.deadline).slice(0, 10), value: project.value ?? 0 }}
          isSubmitting={isSaving}
          submitError={saveError}
          onSubmit={(values) => saveProject(values)}
          onCancel={() => router.push('/projects')}
        />
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm" data-nexen-id="nx-d1356e98-13">
        <h2 className="mb-3 font-semibold" data-nexen-id="nx-d1356e98-14">Tasks</h2>
        {projectTasks.length === 0 && <p className="text-sm text-muted-foreground" data-nexen-id="nx-d1356e98-15">No tasks for this project yet.</p>}
        <ul className="space-y-2" data-nexen-id="nx-d1356e98-16">
          {projectTasks.map((t) => (
            <li key={t.id} className="flex min-w-0 flex-col gap-2 rounded-[var(--radius)] border border-border p-3 sm:flex-row sm:items-center sm:justify-between" data-nexen-id="nx-d1356e98-17">
              <span className="min-w-0 break-words text-sm" data-nexen-id="nx-d1356e98-18">{t.title}</span>
              {isOwner && (
                <select
                  value={t.assigneeId ?? ''}
                  onChange={(e) => assignTask(t.id, e.target.value)}
                  className="w-full max-w-xs rounded-[var(--radius)] border border-border bg-background px-2 py-1 text-sm sm:w-auto"
                 data-nexen-id="nx-d1356e98-19">
                  <option value="">Unassigned</option>
                  {activeTeam.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Task title"
            className="min-w-0 flex-1 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
           data-nexen-id="nx-d1356e98-20"/>
          <input
            type="date"
            value={taskDueDate}
            onChange={(e) => setTaskDueDate(e.target.value)}
            className="rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
           data-nexen-id="nx-d1356e98-21"/>
          <button type="button" onClick={addTask} className="rounded-[var(--radius)] bg-[hsl(var(--primary))] px-3 py-2 text-sm text-[hsl(var(--primary-foreground))]" data-nexen-id="nx-d1356e98-22">Add task</button>
        </div>
        {taskError && <p className="mt-2 text-sm text-[hsl(var(--destructive))]" data-nexen-id="nx-d1356e98-23">{taskError}</p>}
      </section>

      <section className="min-w-0 space-y-3 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm" data-nexen-id="nx-d1356e98-24">
        <h2 className="font-semibold" data-nexen-id="nx-d1356e98-25">Linked invoices</h2>
        <div className="overflow-x-auto">
          <InvoicesTable invoices={linkedInvoices} currency={currency} emptyMessage="No invoices linked to this project yet." />
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <select
            value={pickedInvoiceId}
            onChange={(e) => setPickedInvoiceId(e.target.value)}
            className="min-w-0 flex-1 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
           data-nexen-id="nx-d1356e98-26">
            <option value="">Select an invoice for this client</option>
            {pickable.map((i) => <option key={i.id} value={i.id}>{i.invoiceNumber}</option>)}
          </select>
          <button type="button" onClick={linkInvoice} disabled={!pickedInvoiceId} className="rounded-[var(--radius)] border border-border px-3 py-2 text-sm disabled:opacity-50" data-nexen-id="nx-d1356e98-27">Link invoice</button>
        </div>
      </section>
    </div>
  );
}