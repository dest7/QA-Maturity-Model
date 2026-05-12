/**
 * Схема базы данных — таблицы модели зрелости QA.
 *
 * Содержит четыре таблицы:
 *
 * 1. skills — справочник навыков (15 записей, не меняются в рантайме)
 *    Каждый навык принадлежит одной из 5 категорий и имеет описание 4 уровней зрелости.
 *    Поля level* — массивы строк длиной 4, где индекс соответствует уровню (0..3):
 *      - levelDescriptions   — краткое описание состояния на данном уровне
 *      - levelRequirements   — что конкретно должно выполняться на этом уровне
 *      - levelArtifacts      — артефакты, подтверждающие достижение уровня
 *      - levelRecommendations — рекомендации для перехода на следующий уровень
 *
 * 2. teams — команды с их общим уровнем зрелости
 *    overallLevel вычисляется автоматически при каждом изменении уровня навыка
 *    (алгоритм: >= 85% навыков достигли уровня N).
 *    assessmentStatus — текущий статус проведения оценки ('planned'|'in_progress'|'completed'|'on_hold').
 *    lastAssessedAt   — время последнего изменения уровня любого навыка команды (авто-обновление).
 *    deletedAt        — null означает активную команду; заполненное значение = soft-delete.
 *
 * 3. team_skill_levels — связующая таблица "команда × навык → уровень"
 *    При создании команды автоматически создаются 15 записей (по одной на каждый навык)
 *    с начальным уровнем 0.
 *    CASCADE DELETE гарантирует, что при удалении команды или навыка из БД
 *    связанные записи уровней тоже удаляются.
 *
 * 4. team_skill_artifacts — артефакты, прикреплённые командой к конкретному навыку
 *    В отличие от levelArtifacts (который описывает *что должно быть*),
 *    эта таблица хранит *что реально есть*: ссылки, документы, заметки.
 */

import { pgTable, text, serial, integer, timestamp, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Организационные единицы — рекурсивное дерево произвольной глубины.
 * parent_id = NULL → корневой узел (Управление).
 * Команды привязываются к любому узлу через teamsTable.org_unit_id.
 */
export const orgUnitsTable = pgTable("org_units", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  parentId: integer("parent_id"), // self-reference; FK добавлен через ALTER TABLE в миграции
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const skillsTable = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  // Массивы строк по 4 элемента (индекс = уровень зрелости 0..3)
  levelDescriptions: text("level_descriptions").array().notNull(),
  levelRequirements: text("level_requirements").array().notNull().default([]),
  levelArtifacts: text("level_artifacts").array().notNull().default([]),
  levelRecommendations: text("level_recommendations").array().notNull().default([]),
});

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  // Привязка к узлу организационного дерева (nullable = без структуры)
  orgUnitId: integer("org_unit_id"),
  // Кэшированное значение общего уровня зрелости; пересчитывается при каждом PUT /skills/:id
  overallLevel: integer("overall_level").notNull().default(0),
  // Статус проведения оценки зрелости
  assessmentStatus: text("assessment_status").notNull().default("planned"),
  // Время последнего изменения уровня навыка; null = оценка ещё не начиналась
  lastAssessedAt: timestamp("last_assessed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Soft-delete: null = активна, дата = архивирована
  deletedAt: timestamp("deleted_at"),
});

export const teamSkillLevelsTable = pgTable("team_skill_levels", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  skillId: integer("skill_id").notNull().references(() => skillsTable.id, { onDelete: "cascade" }),
  // Текущий уровень зрелости команды по данному навыку (0..3)
  level: integer("level").notNull().default(0),
  // Свободный текст — заметки команды по данному навыку (контекст, план действий и т.д.)
  notes: text("notes"),
});

export const teamSkillArtifactsTable = pgTable("team_skill_artifacts", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  skillId: integer("skill_id").notNull().references(() => skillsTable.id, { onDelete: "cascade" }),
  // Название артефакта (обязательное)
  name: text("name").notNull(),
  // Ссылка на артефакт (URL, путь к документу и т.д.)
  link: text("link"),
  // Дополнительных заметки
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * team_skill_snapshots — ежедневные снимки уровней навыков команд.
 * Создаются автоматически раз в день (cron) или вручную по кнопке.
 * Используется для построения гистограмм динамики зрелости за период.
 * UNIQUE (team_id, skill_id, snapshot_date) гарантирует не более 1 снимка в день.
 */
export const teamSkillSnapshotsTable = pgTable("team_skill_snapshots", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  skillId: integer("skill_id").notNull().references(() => skillsTable.id, { onDelete: "cascade" }),
  level: integer("level").notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("team_skill_snapshots_unique").on(table.teamId, table.skillId, table.snapshotDate),
]);

/**
 * team_skill_history — лог изменений уровней навыков.
 * Каждая запись фиксирует факт изменения: кто, когда, старый/новый уровень.
 * Используется для:
 *   - аудита изменений (кто изменил уровень)
 *   - онлайн-аналитики (сегодняшние изменения)
 *   - отладки и расследования инцидентов
 */
export const teamSkillHistoryTable = pgTable("team_skill_history", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  skillId: integer("skill_id").notNull().references(() => skillsTable.id, { onDelete: "cascade" }),
  oldLevel: integer("old_level"),
  newLevel: integer("new_level").notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  changedByUserId: integer("changed_by_user_id"), // FK к users будет добавлен через миграцию
});

// Zod-схемы для валидации входных данных (omit исключает поля, заполняемые сервером)
export const insertSkillSchema = createInsertSchema(skillsTable).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true, overallLevel: true, lastAssessedAt: true });
export const insertTeamSkillLevelSchema = createInsertSchema(teamSkillLevelsTable).omit({ id: true });
export const insertTeamSkillArtifactSchema = createInsertSchema(teamSkillArtifactsTable).omit({ id: true, createdAt: true });
export const insertTeamSkillSnapshotSchema = createInsertSchema(teamSkillSnapshotsTable).omit({ id: true, createdAt: true });
export const insertTeamSkillHistorySchema = createInsertSchema(teamSkillHistoryTable).omit({ id: true, changedAt: true });

// TypeScript-типы, выведенные автоматически из схемы таблиц
export type Skill = typeof skillsTable.$inferSelect;
export type Team = typeof teamsTable.$inferSelect;
export type TeamSkillLevel = typeof teamSkillLevelsTable.$inferSelect;
export type TeamSkillArtifact = typeof teamSkillArtifactsTable.$inferSelect;
export type TeamSkillSnapshot = typeof teamSkillSnapshotsTable.$inferSelect;
export type TeamSkillHistory = typeof teamSkillHistoryTable.$inferSelect;
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertTeamSkillLevel = z.infer<typeof insertTeamSkillLevelSchema>;
export type InsertTeamSkillArtifact = z.infer<typeof insertTeamSkillArtifactSchema>;
export type InsertTeamSkillSnapshot = z.infer<typeof insertTeamSkillSnapshotSchema>;
export type InsertTeamSkillHistory = z.infer<typeof insertTeamSkillHistorySchema>;
