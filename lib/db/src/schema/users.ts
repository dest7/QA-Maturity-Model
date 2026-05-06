import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Таблица пользователей системы QA Maturity.
 *
 * Роли:
 *   viewer      — только просмотр
 *   contributor — просмотр + добавление артефактов (только свои команды)
 *   reviewer    — просмотр + изменение уровней + артефакты + статус оценки
 *   manager     — reviewer (только свои команды) + страница метрик компании
 *   admin       — полный доступ, включая управление пользователями и командами
 *
 * assignedTeamIds — используется для ролей contributor и manager:
 *   ограничивает доступ на запись только назначенными командами.
 *   Для viewer, reviewer, admin это поле игнорируется (доступ ко всем командам).
 */
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("viewer"),
  assignedTeamIds: integer("assigned_team_ids").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserRole = "viewer" | "contributor" | "reviewer" | "manager" | "admin";

/** Публичный профиль — без passwordHash */
export type PublicUser = Omit<User, "passwordHash">;
