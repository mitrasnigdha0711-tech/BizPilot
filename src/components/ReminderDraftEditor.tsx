'use client';

import { useEffect, useState } from 'react';
import type { Reminder } from '@/types/reminder';
import {
  updateMyReminder,
  updateAdminReminder,
  createMyReminderApprove,
  createAdminReminderApprove,
  createMyReminderSend,
  createAdminReminderSend,
} from '@/lib/api';

const SUBJECT_MAX = 150;
const BODY_MAX = 5000;

type Props = {
  reminders?: Reminder[] | null;
  isOwner?: boolean;
  onChanged?: () => void;
};

function validate(subject: string, body: string): string | null {
  if (!subject.trim()) return 'Please add a subject line for this reminder.';
  if (subject.length > SUBJECT_MAX) return 'Subject must be 150 characters or fewer.';
  if (!body.trim()) return 'Please write a message body before sending this reminder.';
  if (body.length > BODY_MAX) return 'Message must be 5000 characters or fewer.';
  return null;
}

export default function ReminderDraftEditor({ reminders, isOwner = false, onChanged }: Props) {
  const list = Array.isArray(reminders) ? reminders : [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = list.find((r) => r.id === selectedId) ?? list[0] ?? null;

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSubject(selected?.subject ?? '');
    setBody(selected?.body ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const locked = selected?.status === 'sent';
  const api = isOwner
    ? { update: updateAdminReminder, approve: createAdminReminderApprove, send: createAdminReminderSend }
    : { update: updateMyReminder, approve: createMyReminderApprove, send: createMyReminderSend };

  async function run(action: 'save' | 'approve' | 'send') {
    if (!selected) return;
    const problem = validate(subject, body);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (action === 'save') {
        await api.update(selected.id, { subject, body });
      } else if (action === 'approve') {
        if (selected.status === 'draft') {
          await api.update(selected.id, { subject, body });
          await api.approve(selected.id, {});
        }
      } else {
        await api.send(selected.id, {});
      }
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (list.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border bg-card p-6 text-sm text-muted-foreground">
        No payment reminder drafts yet.
      </div>
    );
  }

  return (
    <div className="grid w-full min-w-0 gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
      <ul className="min-w-0 space-y-2" data-nexen-id="nx-b2bef0f0-0">
        {list.map((r) => {
          const active = selected?.id === r.id;
          return (
            <li data-nexen-component="nx_components_ReminderDraftEditor" key={r.id} data-nexen-id="nx-b2bef0f0-1">
              <button
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`w-full min-w-0 rounded-[var(--radius)] border p-3 text-left text-sm ${
                  active ? 'border-primary bg-card shadow-sm' : 'bg-card/60'
                }`}
               data-nexen-id="nx-b2bef0f0-2">
                <span className="block truncate font-medium" data-nexen-id="nx-b2bef0f0-3">{r.subject || 'Untitled reminder'}</span>
                <span className="block text-xs capitalize text-muted-foreground" data-nexen-id="nx-b2bef0f0-4">{r.status}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <div className="min-w-0 space-y-3 rounded-[var(--radius)] border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-b2bef0f0-5">{selected.status}</span>
            {selected.isUserEdited && (
              <span className="text-xs text-muted-foreground" data-nexen-id="nx-b2bef0f0-6">Edited by you</span>
            )}
          </div>

          <label className="block space-y-1" data-nexen-id="nx-b2bef0f0-7">
            <span className="flex justify-between text-sm font-medium" data-nexen-id="nx-b2bef0f0-8">
              Subject
              <span className="text-xs text-muted-foreground" data-nexen-id="nx-b2bef0f0-9">{subject.length}/{SUBJECT_MAX}</span>
            </span>
            <input
              value={subject}
              disabled={locked || busy}
              onChange={(e) => setSubject(e.target.value)}
              className="h-10 w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 text-sm disabled:opacity-60"
             data-nexen-id="nx-b2bef0f0-10"/>
          </label>

          <label className="block space-y-1" data-nexen-id="nx-b2bef0f0-11">
            <span className="flex justify-between text-sm font-medium" data-nexen-id="nx-b2bef0f0-12">
              Message
              <span className="text-xs text-muted-foreground" data-nexen-id="nx-b2bef0f0-13">{body.length}/{BODY_MAX}</span>
            </span>
            <textarea
              value={body}
              rows={8}
              disabled={locked || busy}
              onChange={(e) => setBody(e.target.value)}
              className="w-full min-w-0 rounded-[var(--radius)] border bg-background p-3 text-sm disabled:opacity-60"
             data-nexen-id="nx-b2bef0f0-14"/>
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-b2bef0f0-15">
              {error}
            </p>
          )}

          {locked ? (
            <p className="text-sm text-muted-foreground" data-nexen-id="nx-b2bef0f0-16">
              Sent. This copy is locked so it matches what the client received.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => run('save')}
                className="h-10 rounded-[var(--radius)] border px-4 text-sm font-semibold disabled:opacity-50"
               data-nexen-id="nx-b2bef0f0-17">
                Save edits
              </button>
              {selected.status === 'draft' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run('approve')}
                  className="h-10 rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                 data-nexen-id="nx-b2bef0f0-18">
                  Approve
                </button>
              )}
              {selected.status === 'approved' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run('send')}
                  className="h-10 rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                 data-nexen-id="nx-b2bef0f0-19">
                  Send reminder
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}