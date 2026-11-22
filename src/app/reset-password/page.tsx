'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createAuthResetPassword, ApiError } from '@/lib/api';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function validatePasswords(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return 'Password must be between 8 and 128 characters.';
  }
  if (!confirmation) {
    return 'Please confirm your new password.';
  }
  if (password !== confirmation) {
    return 'Passwords do not match.';
  }
  return null;
}

const inputClass =
  'mt-1 h-10 w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-60';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams.get('token') ?? '').trim();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(!token);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setLinkInvalid(true);
      return;
    }
    const validationError = validatePasswords(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const reset = await createAuthResetPassword({ token, password });
      if (!reset) {
        setError('We could not save your new password. Please try again.');
        return;
      }
      router.push('/login');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'We could not save your new password. Please try again.';
      if (/expired|invalid/i.test(message)) {
        setLinkInvalid(true);
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (linkInvalid) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm">
        <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-5beb24c0-0">
          This reset link is invalid or has expired. Request a new reset link to continue.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/forgot-password"
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] bg-primary px-5 text-sm font-semibold text-primary-foreground"
           data-nexen-id="nx-5beb24c0-1">
            Request a new reset link
          </Link>
          <Link href="/login" className="text-center text-sm text-muted-foreground hover:text-foreground" data-nexen-id="nx-5beb24c0-2">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm"
     data-nexen-id="nx-5beb24c0-3">
      <label className="block text-sm font-medium text-foreground" data-nexen-id="nx-5beb24c0-4">
        New password
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
          className={inputClass}
         data-nexen-id="nx-5beb24c0-5"/>
      </label>

      <label className="block text-sm font-medium text-foreground" data-nexen-id="nx-5beb24c0-6">
        Confirm new password
        <input
          type="password"
          name="confirmation"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          disabled={isSubmitting}
          className={inputClass}
         data-nexen-id="nx-5beb24c0-7"/>
      </label>

      {error && (
        <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-5beb24c0-8">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius)] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
       data-nexen-id="nx-5beb24c0-9">
        {isSubmitting ? 'Saving…' : 'Save new password'}
      </button>

      <Link href="/login" className="text-center text-sm text-muted-foreground hover:text-foreground" data-nexen-id="nx-5beb24c0-10">
        Back to sign in
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main data-nexen-component="nx_app_reset_password_page" className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-12" data-nexen-id="nx-5beb24c0-11">
      <div className="text-center">
        <p className="text-lg font-bold text-foreground" data-nexen-id="nx-5beb24c0-12">BizPilot</p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground" data-nexen-id="nx-5beb24c0-13">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground" data-nexen-id="nx-5beb24c0-14">
          This new password replaces your old one for your BizPilot account.
        </p>
      </div>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}