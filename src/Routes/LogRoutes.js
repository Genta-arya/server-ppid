import { Router } from "express";
import { GetAllLog } from "../Controller/Form.controller.js";

const routerLog = Router();


routerLog.get("/all", GetAllLog);


export default routerLog;
