'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  createAuthChangePassword,
  createAuthLogout,
  getAuthMe,
  updateAuthMe,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/types/user';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT_CLASS =
  'mt-1 w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground';
const BUTTON_CLASS =
  'rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60';
const CARD_CLASS =
  'rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm sm:p-6';

function messageFrom(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export default function ProfilePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    getAuthMe()
      .then((me) => {
        if (!active) return;
        setUser(me);
        setName(me.name);
        setEmail(me.email);
      })
      .catch((err) => {
        if (active) setLoadError(messageFrom(err, 'Could not load your account.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(false);
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName) return setProfileError('Please enter your name.');
    if (trimmedName.length > 100) return setProfileError('Name must be 100 characters or fewer.');
    if (!normalizedEmail) return setProfileError('Please enter your email address.');
    if (!EMAIL_PATTERN.test(normalizedEmail)) return setProfileError('Please enter a valid email address.');

    setSavingProfile(true);
    try {
      const updated = await updateAuthMe({ name: trimmedName, email: normalizedEmail });
      setUser(updated);
      setName(updated.name);
      setEmail(updated.email);
      setProfileSaved(true);
    } catch (err) {
      setProfileError(messageFrom(err, 'Could not save your account details.'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);

    if (!newPassword) return setPasswordError('Please enter a new password.');
    if (!currentPassword) return setPasswordError('Please enter your current password.');
    if (newPassword.length < 8) return setPasswordError('Password must be at least 8 characters.');
    if (confirmPassword !== newPassword) return setPasswordError('Passwords do not match.');

    setSavingPassword(true);
    try {
      await createAuthChangePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(messageFrom(err, 'Could not update your password.'));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await createAuthLogout({});
    } catch {
      // Session is cleared locally even if the server call fails.
    } finally {
      logout();
      router.push('/login');
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground" data-nexen-id="nx-99236b1e-0">Loading your account…</p>;
  }

  if (loadError || !user) {
    return <p className="text-sm text-destructive" data-nexen-id="nx-99236b1e-1">{loadError ?? 'Could not load your account.'}</p>;
  }

  return (
    <div data-nexen-component="nx_app_profile_page" className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <header className="min-w-0" data-nexen-id="nx-99236b1e-2">
        <h1 className="text-2xl font-bold text-foreground" data-nexen-id="nx-99236b1e-3">Profile</h1>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-99236b1e-4">
          Manage your own account details, password and sign-in.
        </p>
      </header>

      <form onSubmit={saveProfile} className={CARD_CLASS} noValidate data-nexen-id="nx-99236b1e-5">
        <h2 className="text-lg font-semibold text-foreground" data-nexen-id="nx-99236b1e-6">Account details</h2>
        <div className="mt-4 grid gap-4">
          <label className="block text-sm font-medium text-foreground" data-nexen-id="nx-99236b1e-7">
            Name
            <input
              className={INPUT_CLASS}
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
             data-nexen-id="nx-99236b1e-8"/>
          </label>
          <label className="block text-sm font-medium text-foreground" data-nexen-id="nx-99236b1e-9">
            Email
            <input
              type="email"
              className={INPUT_CLASS}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
             data-nexen-id="nx-99236b1e-10"/>
          </label>
        </div>
        {profileError && <p className="mt-3 text-sm text-destructive" data-nexen-id="nx-99236b1e-11">{profileError}</p>}
        {profileSaved && <p className="mt-3 text-sm text-muted-foreground" data-nexen-id="nx-99236b1e-12">Account details saved.</p>}
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={savingProfile} className={BUTTON_CLASS} data-nexen-id="nx-99236b1e-13">
            {savingProfile ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <form onSubmit={savePassword} className={CARD_CLASS} noValidate data-nexen-id="nx-99236b1e-14">
        <h2 className="text-lg font-semibold text-foreground" data-nexen-id="nx-99236b1e-15">Change password</h2>
        <div className="mt-4 grid gap-4">
          <label className="block text-sm font-medium text-foreground" data-nexen-id="nx-99236b1e-16">
            Current password
            <input
              type="password"
              autoComplete="current-password"
              className={INPUT_CLASS}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
             data-nexen-id="nx-99236b1e-17"/>
          </label>
          <label className="block text-sm font-medium text-foreground" data-nexen-id="nx-99236b1e-18">
            New password
            <input
              type="password"
              autoComplete="new-password"
              className={INPUT_CLASS}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
             data-nexen-id="nx-99236b1e-19"/>
          </label>
          <label className="block text-sm font-medium text-foreground" data-nexen-id="nx-99236b1e-20">
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              className={INPUT_CLASS}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
             data-nexen-id="nx-99236b1e-21"/>
          </label>
        </div>
        {passwordError && <p className="mt-3 text-sm text-destructive" data-nexen-id="nx-99236b1e-22">{passwordError}</p>}
        {passwordSaved && <p className="mt-3 text-sm text-muted-foreground" data-nexen-id="nx-99236b1e-23">Password updated.</p>}
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={savingPassword} className={BUTTON_CLASS} data-nexen-id="nx-99236b1e-24">
            {savingPassword ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>

      <section className={CARD_CLASS} data-nexen-id="nx-99236b1e-25">
        <h2 className="text-lg font-semibold text-foreground" data-nexen-id="nx-99236b1e-26">Sign out</h2>
        <p className="mt-1 text-sm text-muted-foreground" data-nexen-id="nx-99236b1e-27">
          You will need to sign in again to reach your business data. Your records are not changed.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
           data-nexen-id="nx-99236b1e-28">
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </section>
    </div>
  );
}