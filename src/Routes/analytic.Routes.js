import { Router } from "express";
import { GetAIInsightStatus, GetAnalytics, PostAnalytic } from "../Controller/analytic.controller.js";

const routerAnalytic = Router();

routerAnalytic.post("/analytic", PostAnalytic);
routerAnalytic.get("/analytic", GetAnalytics);
routerAnalytic.get("/insight/status", GetAIInsightStatus);

export default routerAnalytic;
