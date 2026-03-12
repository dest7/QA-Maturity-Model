import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { skillsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  const skills = await db.select().from(skillsTable).orderBy(skillsTable.id);
  res.json(skills);
});

export default router;
