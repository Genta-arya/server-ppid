import express from "express";
import { createServer } from "http";
import cors from "cors";
import webRoutes from "./web.js";
import "dotenv/config";

const app = express();
const PORT = 8080;
const httpServer = createServer(app);
app.use(express.json());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use("/", webRoutes);

httpServer.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
