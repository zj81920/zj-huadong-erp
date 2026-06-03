"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { resolveUserPermissions, UserModulePermission, MODULE_KEYS, SUB_MODULE_KEYS } from "@/lib/module-permissions";

const defaultPermissions: UserModulePermission = {
  accessibleModules: [...MODULE_KEYS],
  accessibleSubModules: [...SUB_MODULE_KEYS],
  isGlobalVisible: true,
};

interface UserRole {
  id: string;
  code: string;
  name: string;
  isProjectRole: boolean;
  accessibleModules: string;
  isGlobalVisible: boolean;
}

interface CurrentUser {
  id: string;
  username: string;
  realName: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  avatarUrl: string | null;
  roles: UserRole[];
}

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  modulePermissions: UserModulePermission;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
  modulePermissions: defaultPermissions,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/current-user");
      if (res.ok) {
        const { data } = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const modulePermissions = useMemo(() => {
    if (!user || !user.roles || user.roles.length === 0) return defaultPermissions;
    if (user.username === "admin") return defaultPermissions;
    return resolveUserPermissions(user.roles);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout, modulePermissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useHasRole(roleCode: string): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return user.roles.some((r) => r.code === roleCode);
}

export function useHasAnyRole(roleCodes: string[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return user.roles.some((r) => roleCodes.includes(r.code));
}
