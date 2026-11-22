
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createMyClient, updateMyClient } from '@/lib/api';
import type { Client } from '@/types/client';

type ClientFormProps = {
  clientId?: string;
  initialValues?: Partial<Pick<Client, 'name' | 'email' | 'phone' | 'address'>>;
};

type FormValues = { name: string; email: string; phone: string; address: string };
type FormErrors = Partial<Record<keyof FormValues, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-()]+$/;

const FIELDS: { key: keyof FormValues; label: string; type?: string; placeholder: string; multiline?: boolean }[] = [
  { key: 'name', label: 'Client name', placeholder: 'Acme Studios' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'name@example.com' },
  { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+1 555 010 2030' },
  { key: 'address', label: 'Address', placeholder: 'Street, city, country', multiline: true },
];

function validate(v: FormValues): FormErrors {
  const errors: FormErrors = {};
  const name = v.name.trim();
  if (!name) {
    errors.name = "Please enter the client's name.";
  } else if (name.length > 120) {
    errors.name = 'Client name must be 120 characters or fewer.';
  }
  const email = v.email.trim();
  if (email && !EMAIL_RE.test(email)) {
    errors.email = 'Please enter a valid email address, such as name@example.com.';
  }
  const phone = v.phone.trim();
  if (phone && (phone.length > 25 || !PHONE_RE.test(phone))) {
    errors.phone = 'Please enter a valid phone number using digits, spaces, dashes or a leading +.';
  }
  if (v.address.trim().length > 300) {
    errors.address = 'Address must be 300 characters or fewer.';
  }
  return errors;
}

const inputClass =
  'w-full min-w-0 rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function ClientForm({ clientId, initialValues }: ClientFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({
    name: initialValues?.name ?? '',
    email: initialValues?.email ?? '',
    phone: initialValues?.phone ?? '',
    address: initialValues?.address ?? '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handleChange(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      name: values.name.trim(),
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      address: values.address.trim() || null,
    };

    setIsSaving(true);
    try {
      const client = clientId
        ? await updateMyClient(clientId, payload)
        : await createMyClient(payload);
      router.push(`/clients/${client.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save the client. Please try again.');
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="w-full max-w-xl space-y-5 rounded-[var(--radius)] border border-border bg-card/60 p-6 shadow-sm backdrop-blur"
     data-nexen-id="nx-80bcb713-0">
      {FIELDS.map((f) => {
        const id = `client-${f.key}`;
        const fieldError = errors[f.key];
        return (
          <div data-nexen-component="nx_components_ClientForm" key={f.key} className="min-w-0 space-y-1.5">
            <label htmlFor={id} className="text-sm font-medium text-foreground" data-nexen-id="nx-80bcb713-1">
              {f.label}
              {f.key === 'name' && <span className="text-destructive" data-nexen-id="nx-80bcb713-2"> *</span>}
            </label>
            {f.multiline ? (
              <textarea
                id={id}
                rows={3}
                value={values[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => handleChange(f.key, e.target.value)}
                className={inputClass}
                aria-invalid={fieldError ? true : undefined}
               data-nexen-id="nx-80bcb713-3"/>
            ) : (
              <input
                id={id}
                type={f.type ?? 'text'}
                value={values[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => handleChange(f.key, e.target.value)}
                className={inputClass}
                aria-invalid={fieldError ? true : undefined}
               data-nexen-id="nx-80bcb713-4"/>
            )}
            {fieldError && (
              <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-80bcb713-5">
                {fieldError}
              </p>
            )}
          </div>
        );
      })}

      {submitError && (
        <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-80bcb713-6">
          {submitError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href="/clients"
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] border border-border px-5 text-sm font-semibold text-foreground hover:bg-muted"
         data-nexen-id="nx-80bcb713-7">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
         data-nexen-id="nx-80bcb713-8">
          {isSaving ? 'Saving…' : 'Save client'}
        </button>
      </div>
    </form>
  );
}