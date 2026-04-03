import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import morgan from "morgan";
import "dotenv/config";
import webRoutes from "./web.js";
import apiKeyMiddleware from "./src/Config/midleware.js";

const app = express();
const PORT = process.env.PORT || 8080;
const httpServer = createServer(app);

// 1. Logging Request
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// 2. Keamanan Header & Sembunyikan Identitas Server
app.use(helmet());
app.disable("x-powered-by");

// 3. Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    status: 429,
    message: "Terlalu banyak request, silakan coba lagi nanti.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// 4. Konfigurasi CORS
const allowedOrigins = [
  "https://dashboard.eppid.kpu-sekadau.my.id",
  "https://eppid.kpu-sekadau.my.id",
  "http://localhost:3000",
  "http://localhost:5173",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || /\.kpu-sekadau\.my\.id$/.test(origin) || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Akses ditolak oleh kebijakan CORS PPID"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
};
app.use(cors(corsOptions));

// 5. Body Parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// --- 6. ROUTING STRATEGY (FIXED) ---

/** * A. Rute Publik (Download File)
 * Dipasang SEBELUM apiKeyMiddleware agar bisa diakses langsung lewat link <a>
 */
app.use("/api/form/file/download", webRoutes); 

/** * B. Rute Private (Sisa API lainnya)
 * Dipasang DENGAN apiKeyMiddleware agar aman dari akses liar
 */
app.use("/", (req, res, next) => {
  // Jika request mengarah ke download, jangan minta API Key (karena sudah dihandle di atas)
  if (req.originalUrl.includes("/api/form/file/download")) {
    return next();
  }
  // Selain download, semua WAJIB pakai API Key
  apiKeyMiddleware(req, res, next);
}, webRoutes);

// --- END ROUTING ---

// 7. Middleware 404
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Endpoint tidak ditemukan.",
  });
});

// 8. Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(`[ERROR] ${new Date().toISOString()}: ${err.message}`);
  res.status(statusCode).json({
    status: "error",
    message: process.env.NODE_ENV === "production" ? "Internal server error." : err.message,
  });
});

// 9. Start Server
const server = httpServer.listen(PORT, () => {
  console.log(`🚀 Server KPU Sekadau berjalan di port ${PORT} [Mode: ${process.env.NODE_ENV || "development"}]`);
});

process.on("SIGTERM", () => {
  server.close(() => console.log("Process terminated."));
});