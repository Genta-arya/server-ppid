

import { Router } from "express";
import { getNotification } from "../Controller/Notification.controller.js";
import { notificationStream } from "../Controller/SSE.js";


const notifRouter = Router();

notifRouter.get("/all", getNotification)
notifRouter.get("/stream" , notificationStream)
export default notifRouter;
