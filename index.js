import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet"; // Baru
import { rateLimit } from "express-rate-limit"; // Baru
import webRoutes from "./web.js";
import "dotenv/config";

const app = express();
const PORT = 8080;
const httpServer = createServer(app);

// 1. Keamanan Header
app.use(helmet());
app.disable('x-powered-by');

// 2. Limit Request
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, 
  message: "Terlalu banyak request, santai dulu ya."
});
app.use(limiter);

// 3. CORS Ketat (Sesuai diskusi sebelumnya)
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isMasterDomain = /\.kpu-sekadau\.my\.id$/.test(origin);
    if (isMasterDomain) {
      callback(null, true);
    } else {
      callback(new Error("CORS Blocked"));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: "5mb" })); // Limit diturunkan jika tidak butuh 10mb
app.use(express.urlencoded({ limit: "5mb", extended: true }));

app.use("/", webRoutes);

httpServer.listen(PORT, () => {
  console.log(`Server aman berjalan di port ${PORT}`);
});