import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teamsRouter from "./teams";
import skillsRouter from "./skills";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/teams", teamsRouter);
router.use("/skills", skillsRouter);

export default router;
