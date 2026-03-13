// Variable global untuk menyimpan response object admin yang sedang login
let adminClients = [];

export const sendSSEntNotification = (data) => {
  adminClients.forEach((client) => {
    // Format SSE harus diawali dengan "data: " dan diakhiri dengan "\n\n"
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};

// Endpoint untuk Admin "Subscribe" ke Notifikasi
export const notificationStream = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const clientId = Date.now();
  adminClients.push({ id: clientId, res });
  console.log(`Client ${clientId} connected`);

  // Hapus dari list jika tab dashboard ditutup
  req.on("close", () => {
    adminClients = adminClients.filter((c) => c.id !== clientId);
  });
};
