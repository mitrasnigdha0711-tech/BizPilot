'use client';

import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import ProjectForm from '@/components/ProjectForm';
import { useAuth } from '@/lib/auth';
import {
  createAdminProject,
  createMyProject,
  getAdminClients,
  getMyClients,
} from '@/lib/api';
import type { Client } from '@/types/client';

type ProjectFormProps = ComponentProps<typeof ProjectForm>;
type ProjectFormValues = Parameters<ProjectFormProps['onSubmit']>[0];

export default function NewProjectPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const isOwner = user?.role === 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';

  const [clients, setClients] = useState<Client[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    async function loadClients() {
      try {
        const rows = isOwner ? await getAdminClients() : await getMyClients();
        if (!cancelled) setClients(rows);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load clients.');
        }
      }
    }
    loadClients();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isOwner]);

  async function handleSubmit(values: ProjectFormValues) {
    setSubmitError(null);
    const name = String(values.name ?? '').trim();
    const clientId = String(values.clientId ?? '');
    const deadline = String(values.deadline ?? '');
    const rawValue = String(values.value ?? '').trim();
    const value = Number(rawValue);
    const today = new Date().toLocaleDateString('en-CA');

    if (!name) {
      setSubmitError('Please enter a project name.');
      return;
    }
    if (!clientId) {
      setSubmitError('Please select a client for this project.');
      return;
    }
    if (!deadline || deadline < today) {
      setSubmitError('Please choose a deadline today or later.');
      return;
    }
    if (rawValue === '' || Number.isNaN(value) || value < 0) {
      setSubmitError('Please enter a project value of 0 or more.');
      return;
    }

    const payload = { name, clientId, deadline, value };
    setIsSubmitting(true);
    try {
      if (isOwner) {
        await createAdminProject(payload);
      } else {
        await createMyProject(payload);
      }
      router.push('/projects');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create the project.');
      setIsSubmitting(false);
    }
  }

  if (loading || (isAuthenticated && clients === null && !loadError)) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-80cc4cb1-0">Loading…</p>;
  }

  return (
    <main data-nexen-component="nx_app_projects_new_page" className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6" data-nexen-id="nx-80cc4cb1-1">
      <h1 className="mb-6 text-2xl font-semibold" data-nexen-id="nx-80cc4cb1-2">New project</h1>
      {loadError && (
        <p role="alert" className="mb-4 text-sm text-destructive" data-nexen-id="nx-80cc4cb1-3">
          {loadError}
        </p>
      )}
      <ProjectForm
        clients={clients ?? []}
        initialValues={{}}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/projects')}
      />
    </main>
  );
}