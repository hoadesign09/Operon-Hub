'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { PortalModuleDefinition } from '@/modules/registry';

export interface ClientBranch {
  id: number;
  code: string;
  name: string;
  isHeadquarters: boolean;
}

export interface ClientRole {
  id: number;
  code: string;
  name: string;
  dataScope: 'OWN' | 'DEPARTMENT' | 'BRANCH' | 'ALL';
  branchId: number | null;
}

export interface ClientAuthUser {
  userId: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'LOCKED';
  roles: ClientRole[];
  permissions: string[];
  dataScope: 'OWN' | 'DEPARTMENT' | 'BRANCH' | 'ALL';
  isSuperAdmin: boolean;
  hasAllBranches: boolean;
  branches: ClientBranch[];
}

interface PortalAuthContextValue {
  user: ClientAuthUser | null;
  modules: PortalModuleDefinition[];
  isLoading: boolean;
  error: string | null;
  selectedBranchId: number | null;
  setSelectedBranchId: (branchId: number | null) => void;
  hasPermission: (permission: string) => boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null);

interface MeApiResponse {
  success?: boolean;
  data?: {
    user?: ClientAuthUser;
    modules?: PortalModuleDefinition[];
  };
  error?: { message?: string };
}

async function fetchMeWithRefresh(signal: AbortSignal): Promise<{
  status: 'ok' | 'unauthenticated' | 'error';
  user: ClientAuthUser | null;
  modules: PortalModuleDefinition[];
  error: string | null;
}> {
  let response = await fetch('/api/v1/auth/me', {
    method: 'GET',
    cache: 'no-store',
    signal,
  });

  if (response.status === 401) {
    const refreshRes = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      cache: 'no-store',
      signal,
    });
    if (!refreshRes.ok) {
      return { status: 'unauthenticated', user: null, modules: [], error: null };
    }
    response = await fetch('/api/v1/auth/me', {
      method: 'GET',
      cache: 'no-store',
      signal,
    });
  }

  if (response.status === 401) {
    return { status: 'unauthenticated', user: null, modules: [], error: null };
  }

  const json = (await response.json().catch(() => null)) as MeApiResponse | null;
  if (!response.ok || !json?.success || !json?.data?.user) {
    return {
      status: 'error',
      user: null,
      modules: [],
      error: json?.error?.message ?? '__SESSION_LOAD_ERROR__',
    };
  }

  return {
    status: 'ok',
    user: json.data.user,
    modules: json.data.modules ?? [],
    error: null,
  };
}

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<ClientAuthUser | null>(null);
  const [modules, setModules] = useState<PortalModuleDefinition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  const applySessionResult = useCallback(
    (result: {
      status: 'ok' | 'unauthenticated' | 'error';
      user: ClientAuthUser | null;
      modules: PortalModuleDefinition[];
      error: string | null;
    }) => {
      if (result.status === 'unauthenticated') {
        setUser(null);
        setModules([]);
        setIsLoading(false);
        router.replace('/login');
        return;
      }
      setUser(result.user);
      setModules(result.modules);
      setError(result.error);
      if (result.user && !result.user.hasAllBranches && result.user.branches.length > 0) {
        setSelectedBranchId((prev) => prev ?? result.user?.branches[0]?.id ?? null);
      }
      setIsLoading(false);
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchMeWithRefresh(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          applySessionResult(result);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setError('__AUTH_SERVER_ERROR__');
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [applySessionResult]);

  const refreshSession = useCallback(async () => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchMeWithRefresh(controller.signal);
      applySessionResult(result);
    } catch {
      setError('__AUTH_SERVER_ERROR__');
      setIsLoading(false);
    }
  }, [applySessionResult]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setModules([]);
      router.replace('/login');
    }
  }, [router]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) {
        return false;
      }
      if (user.isSuperAdmin) {
        return true;
      }
      return user.permissions.includes(permission);
    },
    [user],
  );

  const value = useMemo<PortalAuthContextValue>(
    () => ({
      user,
      modules,
      isLoading,
      error,
      selectedBranchId,
      setSelectedBranchId,
      hasPermission,
      refreshSession,
      logout,
    }),
    [
      user,
      modules,
      isLoading,
      error,
      selectedBranchId,
      hasPermission,
      refreshSession,
      logout,
    ],
  );

  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

export function usePortalAuth(): PortalAuthContextValue {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) {
    throw new Error('usePortalAuth must be used within a PortalAuthProvider.');
  }
  return ctx;
}
