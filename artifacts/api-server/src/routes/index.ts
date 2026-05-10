/**
 * Корневой маршрутизатор API.
 *
 * Итоговые пути с учётом префикса /api из app.ts:
 *   GET    /api/healthz                                         — health check
 *   POST   /api/auth/login                                      — вход
 *   POST   /api/auth/logout                                     — выход
 *   GET    /api/auth/me                                         — текущий пользователь
 *   GET    /api/users                                           — список пользователей (admin)
 *   PATCH  /api/users/:id                                       — изменить пользователя (admin)
 *   GET    /api/metrics                                         — сводная аналитика (manager+admin)
 *   GET    /api/teams                                           — список активных команд
 *   POST   /api/teams                                           — создание команды
 *   GET    /api/teams/deleted                                   — архивные команды
 *   GET    /api/teams/:teamId                                   — команда со скилл-уровнями
 *   PUT    /api/teams/:teamId                                   — редактирование команды
 *   PATCH  /api/teams/:teamId/status                           — статус оценки
 *   DEL    /api/teams/:teamId                                   — мягкое удаление
 *   POST   /api/teams/:teamId/restore                          — восстановление
 *   PUT    /api/teams/:teamId/skills/:skillId                  — уровень навыка
 *   GET    /api/teams/:teamId/skills/:skillId/artifacts        — артефакты
 *   POST   /api/teams/:teamId/skills/:skillId/artifacts        — добавить артефакт
 *   DELETE /api/teams/:teamId/skills/:skillId/artifacts/:id   — удалить артефакт
 *   GET    /api/skills                                         — справочник навыков
 */

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import metricsRouter from "./metrics";
import teamsRouter from "./teams";
import skillsRouter from "./skills";
import artifactsRouter from "./artifacts";
import orgUnitsRouter from "./org-units";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/metrics", metricsRouter);
router.use("/org-units", orgUnitsRouter);
router.use("/teams", teamsRouter);
router.use("/teams/:teamId/skills/:skillId/artifacts", artifactsRouter);
router.use("/skills", skillsRouter);

export default router;
