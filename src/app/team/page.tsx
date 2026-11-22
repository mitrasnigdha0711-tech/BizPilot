'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  ApiError,
  createAdminUser,
  createAdminUserDeactivate,
  createAdminUserReactivate,
  getAdminUsers,
  updateAdminUser,
} from '@/lib/api';
import type { User } from '@/types/user';

type Role = 'freelance_video_editor' | 'small_video_editing_business_owner';

const ROLE_LABELS: Record<Role, string> = {
  freelance_video_editor: 'Freelance Video Editor',
  small_video_editing_business_owner: 'Business Owner',
};

const INPUT_CLASS =
  'h-10 w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 text-sm text-foreground';
const BUTTON_CLASS =
  'inline-flex h-9 items-center justify-center rounded-[var(--radius)] border px-3 text-sm font-medium disabled:opacity-50';

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

export default function TeamPage() {
  const router = useRouter();
  const { user, isOwner, isAuthenticated, isLoading: authLoading } = useCurrentUser();

  const [members, setMembers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{ email: string; name: string; role: Role }>({
    email: '',
    name: '',
    role: 'freelance_video_editor',
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  async function loadMembers() {
    try {
      setError(null);
      setMembers(await getAdminUsers());
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    if (isOwner) void loadMembers();
  }, [isOwner]);

  async function addMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createAdminUser({ email: form.email.trim().toLowerCase(), name: form.name.trim(), role: form.role });
      setForm({ email: '', name: '', role: 'freelance_video_editor' });
      await loadMembers();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(member: User, role: Role) {
    setBusyId(member.id);
    setError(null);
    try {
      await updateAdminUser(member.id, { role });
      await loadMembers();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(member: User) {
    setBusyId(member.id);
    setError(null);
    try {
      if (member.isActive) {
        await createAdminUserDeactivate(member.id, {});
      } else {
        await createAdminUserReactivate(member.id, {});
      }
      await loadMembers();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || !isAuthenticated) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-8609c720-0">Loading…</p>;
  }

  if (!isOwner) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        <div className="rounded-[var(--radius)] border bg-card p-6 text-sm text-muted-foreground">
          The team list is not available for your role.
        </div>
      </div>
    );
  }

  const safeMembers = Array.isArray(members) ? members : [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <header className="min-w-0" data-nexen-id="nx-8609c720-1">
        <h1 className="text-2xl font-bold text-foreground" data-nexen-id="nx-8609c720-2">Team</h1>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-8609c720-3">Members of your business, their roles and status.</p>
      </header>

      {error && (
        <p role="alert" className="rounded-[var(--radius)] border p-3 text-sm text-destructive" data-nexen-id="nx-8609c720-4">
          {error}
        </p>
      )}

      <section className="rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-8609c720-5">
        <h2 className="mb-3 text-base font-semibold text-foreground" data-nexen-id="nx-8609c720-6">Add a member</h2>
        <form onSubmit={addMember} className="flex flex-col gap-3 sm:flex-row sm:items-end" data-nexen-id="nx-8609c720-7">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted-foreground" data-nexen-id="nx-8609c720-8">
            Name
            <input
              className={INPUT_CLASS}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
             data-nexen-id="nx-8609c720-9"/>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted-foreground" data-nexen-id="nx-8609c720-10">
            Email
            <input
              type="email"
              className={INPUT_CLASS}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
             data-nexen-id="nx-8609c720-11"/>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted-foreground" data-nexen-id="nx-8609c720-12">
            Role
            <select
              className={INPUT_CLASS}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
             data-nexen-id="nx-8609c720-13">
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className={`${BUTTON_CLASS} w-full bg-primary text-primary-foreground sm:w-auto`}
           data-nexen-id="nx-8609c720-14">
            {submitting ? 'Adding…' : 'Add member'}
          </button>
        </form>
      </section>

      <section className="rounded-[var(--radius)] border bg-card shadow-sm" data-nexen-id="nx-8609c720-15">
        {members === null && !error ? (
          <p className="p-4 text-sm text-muted-foreground" data-nexen-id="nx-8609c720-16">Loading members…</p>
        ) : safeMembers.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-nexen-id="nx-8609c720-17">No team members yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm" data-nexen-id="nx-8609c720-18">
              <thead className="text-xs uppercase text-muted-foreground" data-nexen-id="nx-8609c720-19">
                <tr data-nexen-id="nx-8609c720-20">
                  <th className="p-3" data-nexen-id="nx-8609c720-21">Name</th>
                  <th className="p-3" data-nexen-id="nx-8609c720-22">Email</th>
                  <th className="p-3" data-nexen-id="nx-8609c720-23">Role</th>
                  <th className="p-3" data-nexen-id="nx-8609c720-24">Status</th>
                  <th className="p-3 text-right" data-nexen-id="nx-8609c720-25">Actions</th>
                </tr>
              </thead>
              <tbody data-nexen-id="nx-8609c720-26">
                {safeMembers.map((member) => {
                  const isSelf = member.id === user?.id;
                  const busy = busyId === member.id;
                  return (
                    <tr data-nexen-component="nx_app_team_page" key={member.id} className="border-t" data-nexen-id="nx-8609c720-27">
                      <td className="p-3 text-foreground" data-nexen-id="nx-8609c720-28">{member.name}</td>
                      <td className="p-3 text-muted-foreground" data-nexen-id="nx-8609c720-29">{member.email}</td>
                      <td className="p-3" data-nexen-id="nx-8609c720-30">
                        <select
                          aria-label={`Role for ${member.name}`}
                          className={`${INPUT_CLASS} h-9 w-auto`}
                          value={member.role}
                          disabled={isSelf || busy}
                          onChange={(e) => changeRole(member, e.target.value as Role)}
                         data-nexen-id="nx-8609c720-31">
                          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3" data-nexen-id="nx-8609c720-32">
                        <span className="rounded-[999px] border px-2 py-0.5 text-xs" data-nexen-id="nx-8609c720-33">
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3 text-right" data-nexen-id="nx-8609c720-34">
                        <button
                          type="button"
                          disabled={isSelf || busy}
                          onClick={() => toggleActive(member)}
                          className={BUTTON_CLASS}
                         data-nexen-id="nx-8609c720-35">
                          {member.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}