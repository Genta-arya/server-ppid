// Middleware untuk cek API Key
const apiKeyMiddleware = (req, res, next) => {
  // 1. Loloskan request OPTIONS (Preflight) tanpa cek API Key
  if (req.method === "OPTIONS") {
    return next();
  }

  const clientKey = req.headers["x-api-key"];
  const secretKey = process.env.X_API_KEY;

  // 2. Validasi Key
  if (!clientKey || clientKey !== secretKey) {
    return res.status(401).json({
      status: "error",
      message: "API Key tidak valid.",
    });
  }

  next(); // 3. Lanjut ke webRoutes
};

export default apiKeyMiddleware;
