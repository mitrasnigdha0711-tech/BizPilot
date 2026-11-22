'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createAuthLogin } from '@/lib/api';
import { useAuth, AuthUser } from '@/lib/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginResponse {
  token: string;
  user: AuthUser;
  redirect_to?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): string | null {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return 'Please enter your email address.';
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      return 'Please enter a valid email address, such as name@example.com.';
    }
    if (!password) return 'Please enter your password.';
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const validationError = validate();
    setFieldError(validationError);
    setSubmitError(null);
    if (validationError) return;

    setIsSubmitting(true);
    try {
      const data: LoginResponse = await createAuthLogin({
        email: email.trim().toLowerCase(),
        password,
      });
      login(data.token, data.user);
      router.push('/');
    } catch {
      setSubmitError('Sign-in did not work. Check your email and password and try again.');
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'h-10 w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <main data-nexen-component="nx_app_login_page" className="flex min-h-screen items-center justify-center bg-background px-4 py-12" data-nexen-id="nx-0de71383-0">
      <div className="w-full max-w-sm min-w-0 rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm sm:p-8">
        <header className="mb-6 space-y-2" data-nexen-id="nx-0de71383-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground" data-nexen-id="nx-0de71383-2">Sign in to BizPilot</h1>
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-0de71383-3">
            Sign in to reach your business dashboard.
          </p>
        </header>

        {submitError && (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {submitError}
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="space-y-4" data-nexen-id="nx-0de71383-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground" data-nexen-id="nx-0de71383-5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className={inputClass}
              placeholder="name@example.com"
             data-nexen-id="nx-0de71383-6"/>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground" data-nexen-id="nx-0de71383-7">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className={inputClass}
             data-nexen-id="nx-0de71383-8"/>
            <div className="flex justify-end pt-1">
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
               data-nexen-id="nx-0de71383-9">
                Forgot password?
              </Link>
            </div>
          </div>

          {fieldError && (
            <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-0de71383-10">
              {fieldError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius)] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
           data-nexen-id="nx-0de71383-11">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground" data-nexen-id="nx-0de71383-12">
          No account yet?{' '}
          <Link href="/signup" className="font-semibold text-foreground underline-offset-4 hover:underline" data-nexen-id="nx-0de71383-13">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}