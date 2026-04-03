// Middleware untuk cek API Key
const apiKeyMiddleware = (req, res, next) => {
  const clientKey = req.headers['x-api-key']; // Mengambil key dari header 'x-api-key'
  const secretKey = process.env.X_API_KEY;

  if (!clientKey || clientKey !== secretKey) {
    return res.status(401).json({
      status: "error",
      message: "Akses ditolak: API Key tidak valid atau tidak ditemukan."
    });
  }
  next(); // Lanjut ke webRoutes jika cocok
};

export default apiKeyMiddleware;