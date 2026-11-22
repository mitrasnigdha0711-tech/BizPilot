'use client';

import { useState, type FormEvent } from 'react';
import type { Client } from '@/types/client';

export type ProjectStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export type ProjectFormValues = {
  name: string;
  clientId: string;
  deadline: string;
  value: number;
  status: ProjectStatus;
};

type FormFields = {
  name: string;
  clientId: string;
  deadline: string;
  value: string;
  status: ProjectStatus;
};

type FormErrors = Partial<Record<keyof FormFields, string>>;

type ProjectFormProps = {
  clients: Client[];
  initialValues?: Partial<ProjectFormValues>;
  isSubmitting?: boolean;
  submitError?: string | null;
  onSubmit: (values: ProjectFormValues) => Promise<void> | void;
  onCancel?: () => void;
};

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const LOCKED_STATUSES: ProjectStatus[] = ['completed', 'cancelled'];
const BACKWARD_STATUSES: ProjectStatus[] = ['planned', 'in_progress'];

const inputClass =
  'w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function ProjectForm({
  clients,
  initialValues,
  isSubmitting = false,
  submitError = null,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const safeClients = Array.isArray(clients) ? clients : [];
  const initialStatus: ProjectStatus | undefined = initialValues?.status;

  const [fields, setFields] = useState<FormFields>({
    name: initialValues?.name ?? '',
    clientId: initialValues?.clientId ?? '',
    deadline: initialValues?.deadline ?? '',
    value: initialValues?.value !== undefined ? String(initialValues.value) : '',
    status: initialValues?.status ?? 'planned',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const update = <K extends keyof FormFields>(key: K, val: FormFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const today = new Date().toLocaleDateString('en-CA');
    const numericValue = Number(fields.value);

    if (!fields.name.trim()) next.name = 'Enter a project name.';
    if (!fields.clientId) next.clientId = 'Please select a client for this project.';

    if (!fields.deadline) {
      next.deadline = 'Please choose a deadline today or later.';
    } else if (!initialValues?.deadline && fields.deadline < today) {
      next.deadline = 'Please choose a deadline today or later.';
    }

    if (fields.value.trim() === '' || Number.isNaN(numericValue) || numericValue < 0) {
      next.value = 'Please enter a project value of 0 or more.';
    }

    if (
      initialStatus &&
      LOCKED_STATUSES.includes(initialStatus) &&
      BACKWARD_STATUSES.includes(fields.status)
    ) {
      next.status =
        'Choose a valid status. Completed or cancelled projects cannot move back to planned or in progress.';
    }

    return next;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    await onSubmit({
      name: fields.name.trim(),
      clientId: fields.clientId,
      deadline: fields.deadline,
      value: Number(fields.value),
      status: fields.status,
    });
  };

  return (
    <form data-nexen-component="nx_components_ProjectForm"
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full max-w-xl flex-col gap-4 rounded-[var(--radius)] border border-border bg-card p-4 text-foreground shadow-sm sm:p-6"
     data-nexen-id="nx-4a7de807-0">
      <div className="flex flex-col gap-1">
        <label htmlFor="project-name" className="text-sm font-medium" data-nexen-id="nx-4a7de807-1">
          Project name
        </label>
        <input
          id="project-name"
          type="text"
          value={fields.name}
          onChange={(e) => update('name', e.target.value)}
          className={inputClass}
         data-nexen-id="nx-4a7de807-2"/>
        {errors.name && <span className="text-xs text-[var(--danger,#FF4D4D)]" data-nexen-id="nx-4a7de807-3">{errors.name}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="project-client" className="text-sm font-medium" data-nexen-id="nx-4a7de807-4">
          Client
        </label>
        <select
          id="project-client"
          value={fields.clientId}
          onChange={(e) => update('clientId', e.target.value)}
          className={inputClass}
         data-nexen-id="nx-4a7de807-5">
          <option value="">Select a client</option>
          {safeClients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {errors.clientId && (
          <span className="text-xs text-[var(--danger,#FF4D4D)]" data-nexen-id="nx-4a7de807-6">{errors.clientId}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="project-deadline" className="text-sm font-medium" data-nexen-id="nx-4a7de807-7">
            Deadline
          </label>
          <input
            id="project-deadline"
            type="date"
            value={fields.deadline}
            onChange={(e) => update('deadline', e.target.value)}
            className={inputClass}
           data-nexen-id="nx-4a7de807-8"/>
          {errors.deadline && (
            <span className="text-xs text-[var(--danger,#FF4D4D)]" data-nexen-id="nx-4a7de807-9">{errors.deadline}</span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="project-value" className="text-sm font-medium" data-nexen-id="nx-4a7de807-10">
            Value
          </label>
          <input
            id="project-value"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={fields.value}
            onChange={(e) => update('value', e.target.value)}
            className={inputClass}
           data-nexen-id="nx-4a7de807-11"/>
          {errors.value && <span className="text-xs text-[var(--danger,#FF4D4D)]" data-nexen-id="nx-4a7de807-12">{errors.value}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="project-status" className="text-sm font-medium" data-nexen-id="nx-4a7de807-13">
          Status
        </label>
        <select
          id="project-status"
          value={fields.status}
          onChange={(e) => update('status', e.target.value as ProjectStatus)}
          className={inputClass}
         data-nexen-id="nx-4a7de807-14">
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errors.status && <span className="text-xs text-[var(--danger,#FF4D4D)]" data-nexen-id="nx-4a7de807-15">{errors.status}</span>}
      </div>

      {submitError && (
        <p role="alert" className="text-sm text-[var(--danger,#FF4D4D)]" data-nexen-id="nx-4a7de807-16">
          {submitError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm text-foreground disabled:opacity-50"
           data-nexen-id="nx-4a7de807-17">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
         data-nexen-id="nx-4a7de807-18">
          {isSubmitting ? 'Saving…' : 'Save project'}
        </button>
      </div>
    </form>
  );
}