/**
 * AuthContext — глобальный контекст аутентификации.
 *
 * Заменяет устаревший RoleContext (localStorage-переключатель).
 * При монтировании запрашивает GET /api/auth/me; при 401 считает,
 * что пользователь не авторизован.
 *
 * Матрица прав:
 *   viewer      — только чтение
 *   contributor — чтение + артефакты только своих команд
 *   reviewer    — чтение + уровни + артефакты + статус
 *   manager     — как reviewer, но только свои команды + метрики
 *   admin       — полный доступ
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type UserRole = "viewer" | "contributor" | "reviewer" | "manager" | "admin";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  assignedTeamIds: number[];
  isActive: boolean;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Изменить уровень навыка */
  canEditLevels: (teamId: number) => boolean;
  /** Добавить/удалить артефакт */
  canAddArtifacts: (teamId: number) => boolean;
  /** Изменить статус оценки */
  canChangeStatus: (teamId: number) => boolean;
  /** Создать команду (admin, manager, contributor, reviewer) */
  canCreateTeam: () => boolean;
  /** Создать/удалить/редактировать команды (admin) */
  canManageTeams: () => boolean;
  /** Страница метрик компании */
  canViewMetrics: () => boolean;
  /** Управление пользователями */
  canManageUsers: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  return res;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data ?? null))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Ошибка сети" }));
      throw new Error(err.error ?? "Ошибка входа");
    }
    const data = await res.json();
    setUser(data);
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  // ─── Утилиты прав ─────────────────────────────────────────────────────────

  const canEditLevels = useCallback((teamId: number): boolean => {
    if (!user) return false;
    if (["admin", "reviewer"].includes(user.role)) return true;
    if (user.role === "manager") return user.assignedTeamIds.includes(teamId);
    return false;
  }, [user]);

  const canAddArtifacts = useCallback((teamId: number): boolean => {
    if (!user) return false;
    if (["admin", "reviewer"].includes(user.role)) return true;
    if (["contributor", "manager"].includes(user.role)) return user.assignedTeamIds.includes(teamId);
    return false;
  }, [user]);

  const canChangeStatus = useCallback((teamId: number): boolean => {
    return canEditLevels(teamId);
  }, [canEditLevels]);

  const canManageTeams = useCallback((): boolean => {
    return user?.role === "admin";
  }, [user]);

  const canCreateTeam = useCallback((): boolean => {
    return !!user && ["admin", "manager", "contributor", "reviewer"].includes(user.role);
  }, [user]);

  const canViewMetrics = useCallback((): boolean => {
    return !!user && ["admin", "manager"].includes(user.role);
  }, [user]);

  const canManageUsers = useCallback((): boolean => {
    return user?.role === "admin";
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, isLoading,
      login, logout,
      canEditLevels, canAddArtifacts, canChangeStatus,
      canCreateTeam, canManageTeams, canViewMetrics, canManageUsers,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
