/**
 * Маршруты управления организационными единицами (org_units).
 *
 * Дерево произвольной глубины: Управление → Отдел → Подотдел → ...
 * Команды привязываются к любому узлу через PATCH /api/teams/:id/org-unit.
 *
 * Маршруты:
 *   GET    /api/org-units          — полное дерево (вложенные объекты)
 *   POST   /api/org-units          — создать узел (admin)
 *   PUT    /api/org-units/:id      — переименовать / переназначить родителя (admin)
 *   DELETE /api/org-units/:id      — удалить узел (admin); дети получают parent_id = null
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { orgUnitsTable, teamsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth, requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const CreateBody = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  parentId: z.number().int().positive().nullable().optional(),
});

const UpdateBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  parentId: z.number().int().positive().nullable().optional(),
});

export interface OrgUnitNode {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  children: OrgUnitNode[];
  teamCount: number;
}

/** Строит дерево из плоского списка */
function buildTree(flat: typeof orgUnitsTable.$inferSelect[], teamCounts: Map<number, number>): OrgUnitNode[] {
  const map = new Map<number, OrgUnitNode>();
  for (const unit of flat) {
    map.set(unit.id, { id: unit.id, name: unit.name, description: unit.description, parentId: unit.parentId, children: [], teamCount: teamCounts.get(unit.id) ?? 0 });
  }
  const roots: OrgUnitNode[] = [];
  for (const node of map.values()) {
    if (node.parentId === null) {
      roots.push(node);
    } else {
      const parent = map.get(node.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  // Накапливаем teamCount рекурсивно от листьев к корню
  function accumulate(node: OrgUnitNode): number {
    const childTotal = node.children.reduce((sum, child) => sum + accumulate(child), 0);
    node.teamCount += childTotal;
    return node.teamCount;
  }
  roots.forEach(accumulate);

  return roots;
}

// Получение полного дерева
router.get("/", requireAuth, async (_req, res) => {
  const units = await db.select().from(orgUnitsTable).orderBy(orgUnitsTable.id);
  const teams = await db.select({ orgUnitId: teamsTable.orgUnitId }).from(teamsTable).where(isNull(teamsTable.deletedAt));

  const teamCounts = new Map<number, number>();
  for (const t of teams) {
    if (t.orgUnitId) teamCounts.set(t.orgUnitId, (teamCounts.get(t.orgUnitId) ?? 0) + 1);
  }

  res.json(buildTree(units, teamCounts));
});

// Создание узла (admin)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const body = CreateBody.parse(req.body);
  const [unit] = await db.insert(orgUnitsTable).values({
    name: body.name,
    description: body.description ?? null,
    parentId: body.parentId ?? null,
  }).returning();
  res.status(201).json(unit);
});

// Обновление узла (admin)
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const body = UpdateBody.parse(req.body);

  const existing = await db.select().from(orgUnitsTable).where(eq(orgUnitsTable.id, id));
  if (existing.length === 0) { res.status(404).json({ error: "Not found" }); return; }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.parentId !== undefined) updates.parentId = body.parentId;

  const [updated] = await db.update(orgUnitsTable).set(updates).where(eq(orgUnitsTable.id, id)).returning();
  res.json(updated);
});

// Удаление узла (admin) — дети становятся потомками родителя удалённого узла
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);

  const existing = await db.select().from(orgUnitsTable).where(eq(orgUnitsTable.id, id));
  if (existing.length === 0) { res.status(404).json({ error: "Not found" }); return; }

  const parentId = existing[0].parentId;

  // Перевешиваем детей к деду (или в корень)
  await db.update(orgUnitsTable).set({ parentId }).where(eq(orgUnitsTable.parentId, id));
  // Обнуляем orgUnitId у команд этого узла
  await db.update(teamsTable).set({ orgUnitId: null }).where(eq(teamsTable.orgUnitId, id));

  await db.delete(orgUnitsTable).where(eq(orgUnitsTable.id, id));
  res.json({ success: true });
});

export default router;
