import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import morgan from "morgan"; // Untuk logging request
import "dotenv/config";
import webRoutes from "./web.js";
import apiKeyMiddleware from "./src/Config/midleware.js";

const app = express();
const PORT = process.env.PORT || 8080;
const httpServer = createServer(app);

// 1. Logging Request (Sangat berguna untuk memantau trafik masuk)
// Pakai 'dev' saat development, 'combined' saat production
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// 2. Keamanan Header (Helmet) & Sembunyikan Identitas Server
app.use(helmet());
app.disable("x-powered-by");

// 3. Rate Limiting (Mencegah Brute Force/Spam)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 500, // Dinaikkan sedikit agar tidak terlalu ketat bagi user normal
  message: {
    status: 429,
    message: "Terlalu banyak request dari IP Anda, silakan coba lagi nanti.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
// Terapkan limiter pada semua route API
app.use("/api/", limiter);

// 4. Konfigurasi CORS Ketat & Dinamis
const allowedOrigins = [
  "https://dashboard.eppid.kpu-sekadau.my.id",
  "https://eppid.kpu-sekadau.my.id",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Izinkan jika tanpa origin (Postman/Server-to-Server)
    // ATAU cocok dengan domain kpu-sekadau.my.id
    if (
      !origin ||
      /\.kpu-sekadau\.my\.id$/.test(origin) ||
      allowedOrigins.includes(origin)
    ) {
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

// 5. Body Parser dengan Limit yang Aman
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// 6. Routing
app.use("/", apiKeyMiddleware, webRoutes);

// 7. Middleware Penanganan Route Tidak Ditemukan (404)
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Endpoint tidak ditemukan.",
  });
});

// 8. GLOBAL ERROR HANDLER (Penting agar server tidak crash saat ada error)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(`[ERROR] ${new Date().toISOString()}: ${err.message}`);

  res.status(statusCode).json({
    status: "error",
    message:
      process.env.NODE_ENV === "production"
        ? "Terjadi kesalahan internal server."
        : err.message,
  });
});

// 9. Graceful Shutdown (Menutup koneksi dengan rapi saat server dimatikan)
const server = httpServer.listen(PORT, () => {
  console.log(
    `🚀 Server berjalan aman di port ${PORT} [Mode: ${process.env.NODE_ENV || "development"}]`,
  );
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Closing server gracefully...");
  server.close(() => {
    console.log("Process terminated.");
  });
});
