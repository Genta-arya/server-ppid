import express from "express";
import routerAnalytic from "./src/Routes/analytic.Routes.js";
import routerForm from "./src/Routes/form.Routes.js";

const router = express.Router();

router.use("/api/", routerAnalytic);
router.use("/api/form/", routerForm);

export default router;
