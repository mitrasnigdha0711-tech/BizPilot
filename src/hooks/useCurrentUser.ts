'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAuthMe, getBusinessById } from '@/lib/api';
import type { User } from '@/types/user';
import type { Business } from '@/types/business';

export type UserRole = 'freelance_video_editor' | 'small_video_editing_business_owner';

const USER_ROLES: readonly UserRole[] = [
  'freelance_video_editor',
  'small_video_editing_business_owner',
];

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export interface UseCurrentUserResult {
  user: User | null;
  business: Business | null;
  role: UserRole | null;
  businessId: string | null;
  isOwner: boolean;
  isFreelancer: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef<boolean>(true);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const me = await getAuthMe();
      if (!mountedRef.current) return;
      setUser(me ?? null);

      if (me?.businessId) {
        const biz = await getBusinessById(me.businessId);
        if (!mountedRef.current) return;
        setBusiness(biz ?? null);
      } else {
        setBusiness(null);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setUser(null);
      setBusiness(null);
      setError(e instanceof Error ? e.message : 'Failed to load current user');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const role = useMemo<UserRole | null>(() => {
    if (!user) return null;
    return isUserRole(user.role) ? user.role : null;
  }, [user]);

  const businessId = user?.businessId ?? null;

  return {
    user,
    business,
    role,
    businessId,
    isOwner: role === 'SMALL_VIDEO_EDITING_BUSINESS_OWNER',
    isFreelancer: role === 'FREELANCE_VIDEO_EDITOR',
    isAuthenticated: user !== null,
    isLoading,
    error,
    refetch: load,
  };
}

export default useCurrentUser;