import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router: IRouter = Router();

/** GET /api/users — список всех пользователей (admin) */
router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    assignedTeamIds: usersTable.assignedTeamIds,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

/** PATCH /api/users/:id — изменить роль/назначение/статус (admin) */
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const idParam = req.params.id;
  const id = typeof idParam === "string" ? parseInt(idParam) : NaN;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = req.body as {
    role?: string;
    assignedTeamIds?: number[];
    isActive?: boolean;
    password?: string;
  };

  const { role, assignedTeamIds, isActive, password } = body;

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = typeof role === "string" ? role : undefined;
  if (assignedTeamIds !== undefined) updates.assignedTeamIds = assignedTeamIds;
  if (isActive !== undefined) updates.isActive = isActive;
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Нет полей для обновления" });
    return;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }

  const { passwordHash: _, ...publicUser } = updated;
  res.json(publicUser);
});

export default router;
