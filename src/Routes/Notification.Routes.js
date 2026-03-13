

import { Router } from "express";
import { deleteAll, getNotification, markAsRead, readAll } from "../Controller/Notification.controller.js";
import { notificationStream } from "../Controller/SSE.js";


const notifRouter = Router();

notifRouter.get("/all", getNotification)
notifRouter.get("/stream" , notificationStream)
notifRouter.post("/read-all", readAll)
notifRouter.post("/delete-all", deleteAll)
notifRouter.post("/mark-as-read/:id", markAsRead)
export default notifRouter;
