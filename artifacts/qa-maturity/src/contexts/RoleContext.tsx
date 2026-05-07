/**
 * Контекст ролей пользователя.
 *
 * Роль хранится в localStorage, чтобы сохраняться между перезагрузками страницы.
 *
 * Роли:
 *   viewer   — только просмотр (по умолчанию). Скрывает все кнопки редактирования.
 *   reviewer — полный доступ: изменение уровней навыков, статуса оценки,
 *              добавление/удаление артефактов, управление командами.
 *
 * Архитектурное решение:
 *   Вся логика "откуда пришла роль" инкапсулирована в этом контексте.
 *   При будущей интеграции с корпоративным IdP (OAuth2/OIDC/SAML) достаточно
 *   заменить источник роли в этом файле — остальные компоненты не изменятся.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Role = "viewer" | "reviewer";

interface RoleContextValue {
  role: Role;
  isReviewer: boolean;
  setRole: (role: Role) => void;
  toggleRole: () => void;
}

const STORAGE_KEY = "qa-maturity-role";

function getSavedRole(): Role {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "reviewer" || saved === "viewer") return saved;
  } catch {
    // localStorage may be unavailable
  }
  return "viewer";
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(getSavedRole);

  const setRole = useCallback((newRole: Role) => {
    setRoleState(newRole);
    try {
      localStorage.setItem(STORAGE_KEY, newRole);
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  const toggleRole = useCallback(() => {
    setRole(role === "viewer" ? "reviewer" : "viewer");
  }, [role, setRole]);

  return (
    <RoleContext.Provider value={{ role, isReviewer: role === "reviewer", setRole, toggleRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside <RoleProvider>");
  return ctx;
}
