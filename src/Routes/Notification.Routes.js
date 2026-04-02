

import { Router } from "express";
import { deleteAll, getAccountNotifications, getNotification, markAsRead, readAll, updateAccountAdmin } from "../Controller/Notification.controller.js";
import { notificationStream } from "../Controller/SSE.js";


const notifRouter = Router();

notifRouter.get("/all", getNotification)
notifRouter.get("/stream" , notificationStream)
notifRouter.post("/read-all", readAll)
notifRouter.post("/delete-all", deleteAll)
notifRouter.post("/mark-as-read/:id", markAsRead)
notifRouter.get("/account-notifications", getAccountNotifications)
notifRouter.put("/update/account-notifications/:id", updateAccountAdmin)
export default notifRouter;
