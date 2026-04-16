/**
 * Корневой маршрутизатор API.
 *
 * Собирает воедино все суб-роутеры и монтирует их на нужные пути.
 * Итоговые пути с учётом префикса /api из app.ts:
 *   GET    /api/healthz                                         — health check
 *   GET    /api/teams                                           — список активных команд
 *   POST   /api/teams                                           — создание команды
 *   GET    /api/teams/deleted                                   — список архивных команд
 *   GET    /api/teams/:teamId                                   — данные команды со скилл-уровнями
 *   PUT    /api/teams/:teamId                                   — редактирование команды
 *   PATCH  /api/teams/:teamId/status                           — изменение статуса оценки
 *   DEL    /api/teams/:teamId                                   — мягкое удаление
 *   POST   /api/teams/:teamId/restore                          — восстановление из архива
 *   PUT    /api/teams/:teamId/skills/:skillId                  — изменение уровня навыка
 *   GET    /api/teams/:teamId/skills/:skillId/artifacts        — список артефактов навыка
 *   POST   /api/teams/:teamId/skills/:skillId/artifacts        — добавить артефакт
 *   DELETE /api/teams/:teamId/skills/:skillId/artifacts/:id   — удалить артефакт
 *   GET    /api/skills                                         — справочник навыков
 */

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teamsRouter from "./teams";
import skillsRouter from "./skills";
import artifactsRouter from "./artifacts";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/teams", teamsRouter);
// Маршрут артефактов монтируется отдельно с mergeParams для доступа к teamId и skillId
router.use("/teams/:teamId/skills/:skillId/artifacts", artifactsRouter);
router.use("/skills", skillsRouter);

export default router;
