'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { createAuthRegister } from '@/lib/api';
import type { User } from '@/types/user';

type RegisterResult = User & { token?: string };

type FieldName = 'name' | 'email' | 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<FieldName, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_ERROR = 'Could not create your account. Please try again.';

const inputClass =
  'w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60';
const labelClass = 'mb-1 block text-sm font-medium text-foreground';
const errorClass = 'mt-1 text-sm text-destructive';

export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!name.trim()) {
      errors.name = 'Please enter your name.';
    }
    if (!trimmedEmail) {
      errors.email = 'Please enter your email address.';
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address, such as name@example.com.';
    }
    if (!password) {
      errors.password = 'Please enter a password.';
    } else if (password.length < 8) {
      errors.password = 'Your password must be at least 8 characters.';
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const result: RegisterResult = await createAuthRegister({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
      });

      const token = result.token;
      if (!token) {
        setFormError('Your account was created, but signing in failed. Please sign in.');
        setIsSubmitting(false);
        return;
      }

      login(token, {
        id: result.id,
        email: result.email,
        name: result.name,
        role: result.role,
      });
      router.push('/business-setup');
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : DEFAULT_ERROR;
      if (/already exists/i.test(message)) {
        setFieldErrors((prev) => ({ ...prev, email: message }));
      } else {
        setFormError(message);
      }
      setIsSubmitting(false);
    }
  }

  return (
    <main data-nexen-component="nx_app_signup_page" className="flex min-h-screen items-center justify-center bg-background p-4 font-sans text-foreground" data-nexen-id="nx-85022a33-0">
      <div className="w-full max-w-md min-w-0 rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm">
        <header className="mb-6" data-nexen-id="nx-85022a33-1">
          <h1 className="text-2xl font-bold tracking-tight" data-nexen-id="nx-85022a33-2">Create your BizPilot account</h1>
          <p className="mt-2 text-sm text-muted-foreground" data-nexen-id="nx-85022a33-3">
            Your creative business co-pilot for projects, invoices and cashflow.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="space-y-4" data-nexen-id="nx-85022a33-4">
          <div>
            <label htmlFor="name" className={labelClass} data-nexen-id="nx-85022a33-5">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={fieldErrors.name ? true : undefined}
              className={inputClass}
             data-nexen-id="nx-85022a33-6"/>
            {fieldErrors.name && <p className={errorClass} data-nexen-id="nx-85022a33-7">{fieldErrors.name}</p>}
          </div>

          <div>
            <label htmlFor="email" className={labelClass} data-nexen-id="nx-85022a33-8">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={fieldErrors.email ? true : undefined}
              className={inputClass}
             data-nexen-id="nx-85022a33-9"/>
            {fieldErrors.email && <p className={errorClass} data-nexen-id="nx-85022a33-10">{fieldErrors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className={labelClass} data-nexen-id="nx-85022a33-11">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={fieldErrors.password ? true : undefined}
              className={inputClass}
             data-nexen-id="nx-85022a33-12"/>
            {fieldErrors.password && <p className={errorClass} data-nexen-id="nx-85022a33-13">{fieldErrors.password}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className={labelClass} data-nexen-id="nx-85022a33-14">Confirm password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={fieldErrors.confirmPassword ? true : undefined}
              className={inputClass}
             data-nexen-id="nx-85022a33-15"/>
            {fieldErrors.confirmPassword && (
              <p className={errorClass} data-nexen-id="nx-85022a33-16">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          {formError && (
            <p role="alert" className={errorClass} data-nexen-id="nx-85022a33-17">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="w-full rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
           data-nexen-id="nx-85022a33-18">
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground" data-nexen-id="nx-85022a33-19">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline" data-nexen-id="nx-85022a33-20">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}