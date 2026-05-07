import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { PublicUser, UserRole } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

/** Загружает пользователя из БД по userId в сессии и прикрепляет к req.user */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { passwordHash: _, ...publicUser } = user;
  req.user = publicUser;
  next();
}

/** Разрешает только admin */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

/** Разрешает manager и admin */
export function requireManagerOrAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !["manager", "admin"].includes(req.user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

// ─── Утилиты проверки прав ────────────────────────────────────────────────

export function canEditLevels(user: PublicUser, teamId: number): boolean {
  if (["admin", "reviewer"].includes(user.role as UserRole)) return true;
  if (user.role === "manager") return (user.assignedTeamIds ?? []).includes(teamId);
  return false;
}

export function canAddArtifacts(user: PublicUser, teamId: number): boolean {
  if (["admin", "reviewer"].includes(user.role as UserRole)) return true;
  if (["contributor", "manager"].includes(user.role as UserRole)) return (user.assignedTeamIds ?? []).includes(teamId);
  return false;
}

export function canChangeStatus(user: PublicUser, teamId: number): boolean {
  return canEditLevels(user, teamId);
}

export function canManageTeams(user: PublicUser): boolean {
  return user.role === "admin";
}

export function canViewMetrics(user: PublicUser): boolean {
  return ["admin", "manager"].includes(user.role as UserRole);
}

export function canManageUsers(user: PublicUser): boolean {
  return user.role === "admin";
}
