/**
 * Корневой маршрутизатор API.
 *
 * Собирает воедино все суб-роутеры и монтирует их на нужные пути.
 * Итоговые пути с учётом префикса /api из app.ts:
 *   GET  /api/healthz              — проверка работоспособности сервера
 *   GET  /api/teams                — список активных команд
 *   POST /api/teams                — создание команды
 *   GET  /api/teams/deleted        — список архивных команд
 *   GET  /api/teams/:teamId        — данные одной команды со скилл-уровнями
 *   PUT  /api/teams/:teamId        — редактирование команды
 *   DEL  /api/teams/:teamId        — мягкое удаление (архивирование) команды
 *   POST /api/teams/:teamId/restore — восстановление из архива
 *   PUT  /api/teams/:teamId/skills/:skillId — изменение уровня навыка
 *   GET  /api/skills               — список всех навыков (справочник)
 */

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teamsRouter from "./teams";
import skillsRouter from "./skills";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/teams", teamsRouter);
router.use("/skills", skillsRouter);

export default router;
