import express from "express";
import routerAnalytic from "./src/Routes/analytic.Routes.js";
import routerForm from "./src/Routes/form.Routes.js";
import notifRouter from "./src/Routes/Notification.Routes.js";
import routerLog from "./src/Routes/LogRoutes.js";

const router = express.Router();

router.use("/api/", routerAnalytic);
router.use("/api/form/", routerForm);
router.use("/api/notifications/", notifRouter);
router.use("/api/logs/", routerLog);

export default router;
