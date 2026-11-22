'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createAuthForgotPassword } from '@/lib/api';

type ForgotPasswordResult = { message: string; devLink?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONFIRMATION =
  'If an account exists for that email, a password reset link has been sent.';
const DEV_LINK_NOTICE =
  "Email isn't set up for this app \u2014 use this link to reset your password.";
const NO_EMAIL_NOTICE = "Password reset by email isn't set up for this app yet.";

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Please enter your email address.';
  if (trimmed.length > 254) return 'Email address must be 254 characters or fewer.';
  if (!EMAIL_PATTERN.test(trimmed)) {
    return 'Please enter a valid email address, such as name@example.com.';
  }
  return null;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ForgotPasswordResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateEmail(email);
    setFieldError(validationError);
    setRequestError(null);
    if (validationError) return;

    setIsSubmitting(true);
    try {
      const response: ForgotPasswordResult = await createAuthForgotPassword({
        email: email.trim().toLowerCase(),
      });
      setResult(response);
    } catch {
      setRequestError("We couldn't send the reset link. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main data-nexen-component="nx_app_forgot_password_page" className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground" data-nexen-id="nx-d5936786-0">
      <div className="w-full max-w-md min-w-0 rounded-[var(--radius)] border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold" data-nexen-id="nx-d5936786-1">Forgot your password?</h1>
        <p className="mt-2 text-sm text-muted-foreground" data-nexen-id="nx-d5936786-2">
          Enter your email and we will send a link to reset your password.
        </p>

        {result ? (
          <div className="mt-6 space-y-4">
            <p role="status" className="rounded-[var(--radius)] border p-4 text-sm" data-nexen-id="nx-d5936786-3">
              {CONFIRMATION}
            </p>
            {result.devLink ? (
              <div className="space-y-2 text-sm">
                <p data-nexen-id="nx-d5936786-4">{DEV_LINK_NOTICE}</p>
                <Link href={result.devLink} className="break-all text-primary hover:underline" data-nexen-id="nx-d5936786-5">
                  {result.devLink}
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" data-nexen-id="nx-d5936786-6">{NO_EMAIL_NOTICE}</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4" data-nexen-id="nx-d5936786-7">
            {requestError && (
              <p
                role="alert"
                className="rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
               data-nexen-id="nx-d5936786-8">
                {requestError}
              </p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium" data-nexen-id="nx-d5936786-9">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldError) setFieldError(null);
                }}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? 'email-error' : undefined}
                className="h-10 w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 text-sm"
               data-nexen-id="nx-d5936786-10"/>
              {fieldError && (
                <p id="email-error" className="text-sm text-destructive" data-nexen-id="nx-d5936786-11">
                  {fieldError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="h-10 w-full rounded-[var(--radius)] bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
             data-nexen-id="nx-d5936786-12">
              {isSubmitting ? 'Sending\u2026' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm" data-nexen-id="nx-d5936786-13">
          <Link href="/login" className="text-primary hover:underline" data-nexen-id="nx-d5936786-14">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}