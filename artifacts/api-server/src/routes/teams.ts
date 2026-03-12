import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { teamsTable, skillsTable, teamSkillLevelsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateTeamBody,
  UpdateSkillLevelBody,
  GetTeamParams,
  DeleteTeamParams,
  UpdateSkillLevelParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function calculateOverallLevel(skillLevels: { level: number }[]): number {
  const total = skillLevels.length;
  if (total === 0) return 0;
  const threshold = 0.85;
  for (let level = 3; level >= 1; level--) {
    const count = skillLevels.filter((s) => s.level >= level).length;
    if (count / total >= threshold) return level;
  }
  return 0;
}

router.get("/", async (_req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);
  res.json(teams);
});

router.post("/", async (req, res) => {
  const body = CreateTeamBody.parse(req.body);
  const skills = await db.select().from(skillsTable);

  const [team] = await db
    .insert(teamsTable)
    .values({ name: body.name, description: body.description, overallLevel: 0 })
    .returning();

  if (skills.length > 0) {
    await db.insert(teamSkillLevelsTable).values(
      skills.map((s) => ({ teamId: team.id, skillId: s.id, level: 0 }))
    );
  }

  res.status(201).json(team);
});

router.get("/:teamId", async (req, res) => {
  const { teamId } = GetTeamParams.parse(req.params);

  const team = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (team.length === 0) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const skillLevels = await db
    .select({
      skillId: skillsTable.id,
      skillName: skillsTable.name,
      skillCategory: skillsTable.category,
      skillDescription: skillsTable.description,
      levelDescriptions: skillsTable.levelDescriptions,
      level: teamSkillLevelsTable.level,
    })
    .from(teamSkillLevelsTable)
    .innerJoin(skillsTable, eq(skillsTable.id, teamSkillLevelsTable.skillId))
    .where(eq(teamSkillLevelsTable.teamId, teamId))
    .orderBy(skillsTable.id);

  res.json({ ...team[0], skillLevels });
});

router.delete("/:teamId", async (req, res) => {
  const { teamId } = DeleteTeamParams.parse(req.params);
  await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
  res.json({ success: true });
});

router.put("/:teamId/skills/:skillId", async (req, res) => {
  const { teamId, skillId } = UpdateSkillLevelParams.parse(req.params);
  const body = UpdateSkillLevelBody.parse(req.body);

  const existing = await db
    .select()
    .from(teamSkillLevelsTable)
    .where(
      and(eq(teamSkillLevelsTable.teamId, teamId), eq(teamSkillLevelsTable.skillId, skillId))
    );

  if (existing.length === 0) {
    await db
      .insert(teamSkillLevelsTable)
      .values({ teamId, skillId, level: body.level });
  } else {
    await db
      .update(teamSkillLevelsTable)
      .set({ level: body.level })
      .where(
        and(eq(teamSkillLevelsTable.teamId, teamId), eq(teamSkillLevelsTable.skillId, skillId))
      );
  }

  const allLevels = await db
    .select({ level: teamSkillLevelsTable.level })
    .from(teamSkillLevelsTable)
    .where(eq(teamSkillLevelsTable.teamId, teamId));

  const overallLevel = calculateOverallLevel(allLevels);

  await db
    .update(teamsTable)
    .set({ overallLevel })
    .where(eq(teamsTable.id, teamId));

  res.json({ teamId, skillId, level: body.level });
});

export default router;
