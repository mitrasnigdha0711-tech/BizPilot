'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { Quote } from '@/types/quote';
import {
  getMyQuoteToday,
  getAdminQuoteToday,
  updateMyQuote,
  updateAdminQuote,
  createMyQuoteAcceptChallenge,
  createAdminQuoteAcceptChallenge,
  createMyQuoteSkipChallenge,
  createAdminQuoteSkipChallenge,
} from '@/lib/api';

const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

export default function DailyMotivationPage() {
  const router = useRouter();
  const { isOwner, isAuthenticated, isLoading } = useCurrentUser();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const query = { date: new Date().toLocaleDateString('en-CA') };
      const next: Quote = isOwner ? await getAdminQuoteToday(query) : await getMyQuoteToday(query);
      setQuote(next);
    } catch (e) {
      setLoadError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
    if (!isLoading && isAuthenticated) void fetchToday();
  }, [isLoading, isAuthenticated, fetchToday, router]);

  const challengeOpen =
    !!quote?.challengeText && (!quote.challengeStatus || quote.challengeStatus === 'pending');

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  function acceptChallenge() {
    const current = quote;
    if (!current) return setActionError("Today's quote has not loaded yet.");
    if (!challengeOpen) return setActionError('This challenge was already answered today.');
    void runAction(async () => {
      if (isOwner) await createAdminQuoteAcceptChallenge(current.id, {});
      else await createMyQuoteAcceptChallenge(current.id, {});
      setQuote({ ...current, challengeStatus: 'accepted' });
    });
  }

  function skipChallenge() {
    const current = quote;
    if (!current) return setActionError("Today's quote has not loaded yet.");
    if (!challengeOpen) return setActionError('This challenge was already answered today.');
    void runAction(async () => {
      if (isOwner) await createAdminQuoteSkipChallenge(current.id, {});
      else await createMyQuoteSkipChallenge(current.id, {});
      setQuote({ ...current, challengeStatus: 'skipped' });
    });
  }

  function toggleFavourite() {
    const current = quote;
    if (!current) return;
    void runAction(async () => {
      const input = { isFavourite: !current.isFavourite };
      const saved = isOwner ? await updateAdminQuote(current.id, input) : await updateMyQuote(current.id, input);
      setQuote(saved);
    });
  }

  if (isLoading || loading) {
    return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-8ed41009-0">Loading today&apos;s quote…</p>;
  }

  return (
    <main data-nexen-component="nx_app_daily_motivation_page" className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6" data-nexen-id="nx-8ed41009-1">
      <h1 className="text-2xl font-bold text-primary" data-nexen-id="nx-8ed41009-2">Daily motivation</h1>

      {loadError && <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-8ed41009-3">{loadError}</p>}

      {quote && (
        <section className="min-w-0 space-y-4 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-8ed41009-4">
          <blockquote className="text-lg leading-relaxed text-foreground" data-nexen-id="nx-8ed41009-5">&ldquo;{quote.text}&rdquo;</blockquote>
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-8ed41009-6">— {quote.author ?? 'Unknown'}</p>

          {quote.personalSuggestion && (
            <div className="rounded-[var(--radius)] border p-4">
              <h2 className="text-sm font-semibold" data-nexen-id="nx-8ed41009-7">Personal suggestion</h2>
              <p className="mt-1 text-sm text-muted-foreground" data-nexen-id="nx-8ed41009-8">{quote.personalSuggestion}</p>
            </div>
          )}

          {challengeOpen && (
            <div className="space-y-3 rounded-[var(--radius)] border p-4">
              <h2 className="text-sm font-semibold" data-nexen-id="nx-8ed41009-9">Today&apos;s challenge</h2>
              <p className="text-sm text-muted-foreground" data-nexen-id="nx-8ed41009-10">{quote.challengeText}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={busy}
                  onClick={acceptChallenge}
                  className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                 data-nexen-id="nx-8ed41009-11">
                  Accept challenge
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={skipChallenge}
                  className="rounded-[var(--radius)] border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                 data-nexen-id="nx-8ed41009-12">
                  Skip
                </button>
              </div>
            </div>
          )}

          {quote.challengeText && !challengeOpen && (
            <p className="text-sm text-muted-foreground" data-nexen-id="nx-8ed41009-13">
              {quote.challengeStatus === 'accepted' ? 'Challenge accepted — added to your tasks for today.' : 'Challenge skipped for today.'}
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={toggleFavourite}
            className="rounded-[var(--radius)] border px-4 py-2 text-sm font-semibold disabled:opacity-50"
           data-nexen-id="nx-8ed41009-14">
            {quote.isFavourite ? 'Remove from favourites' : 'Save favourite'}
          </button>
        </section>
      )}

      {actionError && <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-8ed41009-15">{actionError}</p>}
    </main>
  );
}