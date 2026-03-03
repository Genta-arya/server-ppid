import { Router } from "express";
import { PostAnalytic } from "../Controller/analytic.controller.js";

const routerAnalytic = Router();

routerAnalytic.post("/analytic", PostAnalytic);

export default routerAnalytic;
