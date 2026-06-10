const apiKeyMiddleware = (req, res, next) => {
  // 1. Loloskan request OPTIONS (Preflight)
  if (req.method === "OPTIONS") {
    return next();
  }

  // 2. DAFTAR RUTE YANG DIIZINKAN TANPA API KEY
  const bypassRoutes = ["/api/notifications", "/api/form/file/download"];
  
  // Jika path saat ini ada di dalam daftar bypass, lewati validasi
  if (bypassRoutes.some((route) => req.originalUrl.includes(route))) {
    return next();
  }

  // 3. Validasi Key untuk rute lainnya
  const clientKey = req.headers["x-api-key"];
  const secretKey = process.env.X_API_KEY;

  if (!clientKey || clientKey !== secretKey) {
    return res.status(401).json({
      status: "error",
      message: "API Key tidak valid.",
    });
  }

  next();
};

export default apiKeyMiddleware;