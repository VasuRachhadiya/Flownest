import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiClient, tokenStore } from '@/services/api';
import type { AuthResponse, OrganizationMembership, UserSummary } from '@/types/api';

interface AuthContextValue {
  user: UserSummary | null;
  organizations: OrganizationMembership[];
  activeOrg: OrganizationMembership | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    organizationName?: string;
    invitationToken?: string;
  }) => Promise<void>;
  logout: () => void;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  updateUserLocal: (user: UserSummary) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => tokenStore.getOrgId());
  const [loading, setLoading] = useState(true);

  const applyAuth = useCallback((res: AuthResponse) => {
    tokenStore.setToken(res.accessToken);
    setUser(res.user);
    setOrganizations(res.organizations);

    const savedOrg = tokenStore.getOrgId();
    const validSaved = savedOrg && res.organizations.some((o) => o.organizationId === savedOrg) ? savedOrg : null;
    const chosenOrg = validSaved || res.activeOrganizationId || res.organizations[0]?.organizationId || null;

    tokenStore.setOrgId(chosenOrg);
    setActiveOrgId(chosenOrg);
  }, []);

  const refreshSession = useCallback(async () => {
    const token = tokenStore.getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiClient.get<AuthResponse>('/auth/session');
      applyAuth(res);
    } catch {
      tokenStore.setToken(null);
      tokenStore.setOrgId(null);
      setUser(null);
      setOrganizations([]);
      setActiveOrgId(null);
    } finally {
      setLoading(false);
    }
  }, [applyAuth]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    applyAuth(res);
  };

  const register = async (payload: {
    fullName: string;
    email: string;
    password: string;
    organizationName?: string;
    invitationToken?: string;
  }) => {
    const res = await apiClient.post<AuthResponse>('/auth/register', payload);
    applyAuth(res);
  };

  const logout = () => {
    tokenStore.setToken(null);
    tokenStore.setOrgId(null);
    setUser(null);
    setOrganizations([]);
    setActiveOrgId(null);
  };

  const switchOrganization = async (orgId: string) => {
    tokenStore.setOrgId(orgId);
    setActiveOrgId(orgId);
    await refreshSession();
  };

  const updateUserLocal = (updated: UserSummary) => {
    setUser(updated);
  };

  const activeOrg = organizations.find((o) => o.organizationId === activeOrgId) || organizations[0] || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        activeOrg,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchOrganization,
        refreshSession,
        updateUserLocal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
