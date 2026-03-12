import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillsTable = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  levelDescriptions: text("level_descriptions").array().notNull(),
});

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  overallLevel: integer("overall_level").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamSkillLevelsTable = pgTable("team_skill_levels", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  skillId: integer("skill_id").notNull().references(() => skillsTable.id, { onDelete: "cascade" }),
  level: integer("level").notNull().default(0),
});

export const insertSkillSchema = createInsertSchema(skillsTable).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true, overallLevel: true });
export const insertTeamSkillLevelSchema = createInsertSchema(teamSkillLevelsTable).omit({ id: true });

export type Skill = typeof skillsTable.$inferSelect;
export type Team = typeof teamsTable.$inferSelect;
export type TeamSkillLevel = typeof teamSkillLevelsTable.$inferSelect;
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertTeamSkillLevel = z.infer<typeof insertTeamSkillLevelSchema>;
