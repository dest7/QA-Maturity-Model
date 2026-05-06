/**
 * Маршруты управления артефактами навыков команды (Team Skill Artifacts).
 *
 * Маршруты:
 *   GET    /api/teams/:teamId/skills/:skillId/artifacts              — список артефактов навыка
 *   POST   /api/teams/:teamId/skills/:skillId/artifacts              — добавить артефакт
 *   PATCH  /api/teams/:teamId/skills/:skillId/artifacts/:artifactId  — обновить артефакт
 *   DELETE /api/teams/:teamId/skills/:skillId/artifacts/:artifactId  — удалить артефакт
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { teamSkillArtifactsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router({ mergeParams: true });

const ArtifactParams = z.object({
  teamId: z.coerce.number().int().positive(),
  skillId: z.coerce.number().int().positive(),
});

const ArtifactIdParams = ArtifactParams.extend({
  artifactId: z.coerce.number().int().positive(),
});

const CreateArtifactBody = z.object({
  name: z.string().min(1, "Название артефакта обязательно"),
  link: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const UpdateArtifactBody = z.object({
  name: z.string().min(1).optional(),
  link: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

router.get("/", async (req, res) => {
  const { teamId, skillId } = ArtifactParams.parse(req.params);
  const artifacts = await db
    .select()
    .from(teamSkillArtifactsTable)
    .where(and(eq(teamSkillArtifactsTable.teamId, teamId), eq(teamSkillArtifactsTable.skillId, skillId)))
    .orderBy(teamSkillArtifactsTable.createdAt);
  res.json(artifacts);
});

router.post("/", async (req, res) => {
  const { teamId, skillId } = ArtifactParams.parse(req.params);
  const body = CreateArtifactBody.parse(req.body);
  const [artifact] = await db
    .insert(teamSkillArtifactsTable)
    .values({ teamId, skillId, name: body.name, link: body.link ?? null, note: body.note ?? null })
    .returning();
  res.status(201).json(artifact);
});

router.patch("/:artifactId", async (req, res) => {
  const { teamId, skillId, artifactId } = ArtifactIdParams.parse(req.params);
  const body = UpdateArtifactBody.parse(req.body);

  const existing = await db
    .select()
    .from(teamSkillArtifactsTable)
    .where(and(eq(teamSkillArtifactsTable.id, artifactId), eq(teamSkillArtifactsTable.teamId, teamId), eq(teamSkillArtifactsTable.skillId, skillId)));

  if (existing.length === 0) { res.status(404).json({ error: "Artifact not found" }); return; }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.link !== undefined) updates.link = body.link;
  if (body.note !== undefined) updates.note = body.note;

  const [updated] = await db
    .update(teamSkillArtifactsTable)
    .set(updates)
    .where(eq(teamSkillArtifactsTable.id, artifactId))
    .returning();

  res.json(updated);
});

router.delete("/:artifactId", async (req, res) => {
  const { teamId, skillId, artifactId } = ArtifactIdParams.parse(req.params);
  const existing = await db
    .select()
    .from(teamSkillArtifactsTable)
    .where(and(eq(teamSkillArtifactsTable.id, artifactId), eq(teamSkillArtifactsTable.teamId, teamId), eq(teamSkillArtifactsTable.skillId, skillId)));
  if (existing.length === 0) { res.status(404).json({ error: "Artifact not found" }); return; }
  await db.delete(teamSkillArtifactsTable).where(eq(teamSkillArtifactsTable.id, artifactId));
  res.json({ success: true });
});

export default router;
