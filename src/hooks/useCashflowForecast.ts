'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAdminCashflowForecasts, getMyCashflowForecasts } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { CashflowForecast } from '@/types/cashflowforecast';

export const CASHFLOW_HORIZONS = [30, 60, 90] as const;
export type CashflowHorizon = (typeof CASHFLOW_HORIZONS)[number];

const OWNER_ROLE = 'small_video_editing_business_owner';

export function useCashflowForecast() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const isOwner = user?.role === OWNER_ROLE;

  const [forecasts, setForecasts] = useState<CashflowForecast[]>([]);
  const [horizon, setHorizon] = useState<CashflowHorizon>(30);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    if (!userId) {
      setForecasts([]);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = isOwner
        ? await getAdminCashflowForecasts()
        : await getMyCashflowForecasts();
      if (requestId !== requestIdRef.current) return;
      setForecasts(Array.isArray(result) ? result : []);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Failed to load cashflow forecast',
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId, isOwner]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const forecast = useMemo<CashflowForecast | null>(() => {
    return (
      forecasts.find((item) => Number(item.horizonDays) === horizon) ?? null
    );
  }, [forecasts, horizon]);

  return {
    forecasts,
    forecast,
    horizon,
    setHorizon,
    horizons: CASHFLOW_HORIZONS,
    isLoading,
    error,
    refetch: load,
  };
}

export default useCashflowForecast;