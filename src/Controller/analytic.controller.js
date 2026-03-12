import { model } from "../Config/GeminiAI.js";
import { prisma } from "../Config/Prisma.js";
import { sendError, sendResponse } from "../Utils/Response.js";

export const PostAnalytic = async (req, res) => {
  try {
    const { ip, userAgent, latitude, longitude, device_id } = req.body;
    const analytic = await prisma.analytic.create({
      data: {
        ip: ip,
        userAgent: userAgent,
        latitude,
        longitude,
        device_id,
      },
    });
    return sendResponse(
      res,
      201,
      "Analytic data recorded successfully",
      analytic,
    );
  } catch (error) {
    return sendError(res, error, "Failed to record analytic data");
  }
};

// export const GetAnalytics = async (req, res) => {
//   try {
//     // Ambil tahun dari query, default ke tahun sekarang
//     const yearFilter = req.query.year
//       ? parseInt(req.query.year)
//       : new Date().getFullYear();

//     // =========================
//     // CEK CACHE AI (3 JAM)
//     // =========================
//     const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

//     const existingInsight = await prisma.aiInsight.findFirst({
//       where: {
//         createdAt: { gte: threeHoursAgo },
//       },
//       orderBy: { createdAt: "desc" },
//     });

//     // =========================
//     // TRAFFIC PENGUNJUNG
//     // =========================
//     const analytics = await prisma.analytic.findMany({
//       select: { createdAt: true },
//     });

//     const visitorMonthly = {};
//     analytics.forEach((a) => {
//       const d = new Date(a.createdAt);
//       if (yearFilter && d.getFullYear() !== yearFilter) return; // filter by year
//       const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
//       visitorMonthly[key] = (visitorMonthly[key] || 0) + 1;
//     });
//     const visitorData = Object.entries(visitorMonthly)
//       .map(([bulan, total]) => ({ bulan, total }))
//       .sort((a, b) => a.total - b.total)
//       .slice(0, 10); // ambil 10 teratas

//     // =========================
//     // TRAFFIC TICKET / LAYANAN
//     // =========================
//     const tickets = await prisma.ticket.findMany({
//       select: {
//         createdAt: true,
//         type: true,
//         respondedAt: true,
//         status: true,
//         caraMemperoleh: true,
//         jenisPemohon: true,
//         pendidikan: true,
//         pekerjaan: true,
//         alamat: true,
//         rincianInformasi: true,
//         tujuanPenggunaan: true,
//         dokumenUrl: true,
//         dokumenName: true,
//       },
//     });
//     const ticketMonthly = {};
//     tickets.forEach((t) => {
//       const d = new Date(t.createdAt);
//       if (yearFilter && d.getFullYear() !== yearFilter) return; // filter by year
//       const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
//       ticketMonthly[key] = (ticketMonthly[key] || 0) + 1;
//     });
//     const ticketData = Object.entries(ticketMonthly)
//       .map(([bulan, total]) => ({ bulan, total }))
//       .sort((a, b) => a.total - b.total)
//       .slice(0, 10); // ambil 10 teratas

//     // =========================
//     // LOKASI PENGUNJUNG
//     // =========================
//     const visitorLocations = await prisma.analytic.findMany({
//       where: {
//         latitude: { not: null },
//         longitude: { not: null },
//         ...(yearFilter
//           ? {
//               createdAt: {
//                 gte: new Date(`${yearFilter}-01-01T00:00:00.000Z`),
//                 lte: new Date(`${yearFilter}-12-31T23:59:59.999Z`),
//               },
//             }
//           : {}),
//       },
//       select: {
//         latitude: true,
//         longitude: true,
//         ip: true,
//         userAgent: true,
//         createdAt: true,
//       },
//     });

//     // =========================
//     // JENIS LAYANAN
//     // =========================
//     const jenisLayanan = await prisma.ticket.groupBy({
//       by: ["type"],
//       _count: true,
//       where: yearFilter
//         ? {
//             createdAt: {
//               gte: new Date(`${yearFilter}-01-01T00:00:00.000Z`),
//               lte: new Date(`${yearFilter}-12-31T23:59:59.999Z`),
//             },
//           }
//         : {},
//     });

//     // =========================
//     // STATUS LAYANAN
//     // =========================
//     const statusTicket = await prisma.ticket.groupBy({
//       by: ["status"],
//       _count: true,
//       where: yearFilter
//         ? {
//             createdAt: {
//               gte: new Date(`${yearFilter}-01-01T00:00:00.000Z`),
//               lte: new Date(`${yearFilter}-12-31T23:59:59.999Z`),
//             },
//           }
//         : {},
//     });

//     // =========================
//     // RESPONSE TIME
//     // =========================
//     const completedTickets = tickets.filter((t) => t.respondedAt);

//     const formatMinutes = (minutes) => {
//       const hours = Math.floor(minutes / 60);
//       const mins = Math.floor(minutes % 60);
//       if (hours === 0) return `${mins} menit`;
//       if (mins === 0) return `${hours} jam`;
//       return `${hours} jam ${mins} menit`;
//     };

//     let avgResponse = 0;
//     if (completedTickets.length > 0) {
//       const total = completedTickets.reduce((sum, t) => {
//         const diff = new Date(t.respondedAt) - new Date(t.createdAt);
//         return sum + diff;
//       }, 0);
//       avgResponse = total / completedTickets.length / (1000 * 60);
//     }
//     const averageResponseTime =
//       avgResponse > 0 ? formatMinutes(avgResponse) : "Belum ada data";

//     // Response time per jenis layanan
//     const responseByType = {};
//     completedTickets.forEach((t) => {
//       const minutes =
//         (new Date(t.respondedAt) - new Date(t.createdAt)) / (1000 * 60);
//       if (!responseByType[t.type])
//         responseByType[t.type] = { totalMinutes: 0, count: 0 };
//       responseByType[t.type].totalMinutes += minutes;
//       responseByType[t.type].count += 1;
//     });

//     const response_time_detail = Object.entries(responseByType)
//       .map(([type, data]) => {
//         const avgMinutes = data.totalMinutes / data.count;
//         return {
//           layanan: type,
//           jumlah_ticket: data.count,
//           avg_response: formatMinutes(avgMinutes),
//         };
//       })
//       .sort((a, b) => {
//         // konversi string avg_response ke menit agar bisa diurutkan
//         const toMinutes = (str) => {
//           const h = str.match(/(\d+) jam/)?.[1] || 0;
//           const m = str.match(/(\d+) menit/)?.[1] || 0;
//           return parseInt(h) * 60 + parseInt(m);
//         };
//         return toMinutes(a.avg_response) - toMinutes(b.avg_response);
//       })
//       .slice(0, 10);

//     if (existingInsight) {
//       return sendResponse(res, 200, "Analytics retrieved", {
//         traffic_pengunjung: visitorData,
//         traffic_ticket: ticketData,
//         jenis_layanan: jenisLayanan,
//         status_ticket: statusTicket,
//         average_response_time: averageResponseTime,
//         response_time_detail,
//         visitor_locations: visitorLocations,
//         ai_insight: existingInsight.insight,
//       });
//     }

//     const prompt = `Kamu adalah analis pelayanan publik untuk dashboard PPID web form pengajuan informasi publik di Komisi Pemilihan Umum Kabupaten Sekadau. Gunakan bahasa Indonesia yang jelas, sederhana, dan profesional. Analisis data berikut:

// - Data pengunjung (maks 50 data pertama): ${JSON.stringify(visitorLocations.slice(0, 50))}
// - Data layanan: ${JSON.stringify(tickets)}
// - Jenis layanan: ${JSON.stringify(jenisLayanan)}
// - Status layanan: ${JSON.stringify(statusTicket)}
// - Rata-rata waktu respon: ${averageResponseTime}

// Gunakan istilah "layanan" selalu, jangan pakai kata "ticket". Sertakan analisis mendalam:

// 1. Tren jumlah pengunjung web form tiap bulan
// 2. Tren permohonan layanan tiap bulan
// 3. Jenis layanan dan tujuan paling populer
// 4. Metode pengajuan layanan paling diminati (EMAIL, WHATSAPP, AMBIL_DI_KANTOR)
// 5. Profil pemohon dominan berdasarkan jenisPemohon, pendidikan, pekerjaan, dan kota/kabupaten
// 6. Analisis waktu respon layanan dan rekomendasi perbaikan
// 7. Kondisi status layanan (DIPROSES, SELESAI, DITOLAK)
// 8. Distribusi wilayah pengunjung
// 9. Dokumen atau informasi yang paling sering diminta
// 10. Insight actionable untuk meningkatkan pelayanan publik
// 11. Rekomendasi prioritas berdasarkan tren dan status layanan

// Balas hanya dengan JSON valid sesuai format ini:
// {
//   "trend_pengunjung": "",
//   "trend_layanan": "",
//   "jenis_layanan_populer": "",
//   "cara_memperoleh_populer": "",
//   "profil_pemohon": "",
//   "analisis_waktu_respon": "",
//   "analisis_lokasi_pengunjung": "",
//   "dokumen_populer": "",
//   "insight": "",
//   "rekomendasi": []
// }`;
//     const result = await model.generateContent(prompt);
//     const aiText = await result.response.text();

//     // =========================
//     // CLEAN JSON AI
//     // =========================
//     let insightJson;
//     try {
//       const jsonMatch = aiText.match(/\{[\s\S]*\}/);
//       if (!jsonMatch) throw new Error("AI tidak mengembalikan JSON");
//       insightJson = JSON.parse(jsonMatch[0]);
//     } catch (err) {
//       console.error("AI JSON parse error:", aiText);
//       insightJson = {
//         trend_pengunjung: "Analisis belum tersedia",
//         trend_layanan: "Analisis belum tersedia",
//         analisis_waktu_respon: "Belum tersedia",
//         analisis_lokasi_pengunjung: "Belum tersedia",
//         insight: "AI gagal memproses data",
//         rekomendasi: [],
//       };
//     }

//     await prisma.aiInsight.create({ data: { insight: insightJson } });

//     // =========================
//     // RETURN RESPONSE
//     // =========================
//     return sendResponse(res, 200, "Analytics retrieved", {
//       traffic_pengunjung: visitorData,
//       traffic_ticket: ticketData,
//       jenis_layanan: jenisLayanan,
//       status_ticket: statusTicket,
//       average_response_time: averageResponseTime,
//       response_time_detail,
//       visitor_locations: visitorLocations,
//       ai_insight: existingInsight ? existingInsight.insight : {}, // cache AI jika ada
//     });
//   } catch (error) {
//     return sendError(res, error, "Failed to fetch analytics");
//   }
// };

if (!global.aiInsightRunning) global.aiInsightRunning = {};

export const GetAnalytics = async (req, res) => {
  try {
    const yearFilter = req.query.year
      ? parseInt(req.query.year)
      : new Date().getFullYear();
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const cacheKey = `insight-${yearFilter}`;

    // =========================
    // Cek cache AI terbaru 3 jam terakhir
    // =========================
    let existingInsight = await prisma.aiInsight.findFirst({
      where: { cacheKey, createdAt: { gte: threeHoursAgo } },
      orderBy: { createdAt: "desc" },
    });

    // =========================
    // DATA PENGUNJUNG
    // =========================
    const analytics = await prisma.analytic.findMany({
      select: { createdAt: true },
    });
    const visitorMonthly = {};
    analytics.forEach((a) => {
      const d = new Date(a.createdAt);
      if (yearFilter && d.getFullYear() !== yearFilter) return;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      visitorMonthly[key] = (visitorMonthly[key] || 0) + 1;
    });
    const visitorData = Object.entries(visitorMonthly)
      .map(([bulan, total]) => ({ bulan, total }))
      .sort((a, b) => a.total - b.total)
      .slice(0, 10);

    // =========================
    // DATA TIKET / LAYANAN
    // =========================
    const tickets = await prisma.ticket.findMany({
      select: {
        createdAt: true,
        type: true,
        respondedAt: true,
        status: true,
        caraMemperoleh: true,
        jenisPemohon: true,
        pendidikan: true,
        pekerjaan: true,
        alamat: true,
        rincianInformasi: true,
        tujuanPenggunaan: true,
        dokumenUrl: true,
        dokumenName: true,
      },
    });

    const ticketMonthly = {};
    tickets.forEach((t) => {
      const d = new Date(t.createdAt);
      if (yearFilter && d.getFullYear() !== yearFilter) return;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      ticketMonthly[key] = (ticketMonthly[key] || 0) + 1;
    });
    const ticketData = Object.entries(ticketMonthly)
      .map(([bulan, total]) => ({ bulan, total }))
      .sort((a, b) => a.total - b.total)
      .slice(0, 10);

    // =========================
    // LOKASI PENGUNJUNG
    // =========================
    const visitorLocations = await prisma.analytic.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        ...(yearFilter
          ? {
              createdAt: {
                gte: new Date(`${yearFilter}-01-01T00:00:00.000Z`),
                lte: new Date(`${yearFilter}-12-31T23:59:59.999Z`),
              },
            }
          : {}),
      },
      select: {
        latitude: true,
        longitude: true,
        ip: true,
        userAgent: true,
        createdAt: true,
      },
    });

    // =========================
    // JENIS LAYANAN & STATUS
    // =========================
    const jenisLayanan = await prisma.ticket.groupBy({
      by: ["type"],
      _count: true,
      where: yearFilter
        ? {
            createdAt: {
              gte: new Date(`${yearFilter}-01-01T00:00:00.000Z`),
              lte: new Date(`${yearFilter}-12-31T23:59:59.999Z`),
            },
          }
        : {},
    });

    const statusTicket = await prisma.ticket.groupBy({
      by: ["status"],
      _count: true,
      where: yearFilter
        ? {
            createdAt: {
              gte: new Date(`${yearFilter}-01-01T00:00:00.000Z`),
              lte: new Date(`${yearFilter}-12-31T23:59:59.999Z`),
            },
          }
        : {},
    });

    // =========================
    // 1. QUERY KHUSUS TIKET TERESPON (BY TAHUN)
    // =========================
    const responseTickets = await prisma.ticket.findMany({
      where: {
        createdAt: {
          gte: new Date(`${yearFilter}-01-01T00:00:00.000Z`),
          lte: new Date(`${yearFilter}-12-31T23:59:59.999Z`),
        },
        respondedAt: { not: null }, // Hanya ambil yang sudah direspon
      },
      select: {
        type: true,
        createdAt: true,
        respondedAt: true,
      },
    });

    // =========================
    // 2. HELPER FORMATTER
    // =========================
    const formatMinutes = (minutes) => {
      if (minutes < 1) return "Kurang dari 1 menit";
      const d = Math.floor(minutes / 1440);
      const h = Math.floor((minutes % 1440) / 60);
      const m = Math.floor(minutes % 60);

      const parts = [];
      if (d > 0) parts.push(`${d} hari`);
      if (h > 0) parts.push(`${h} jam`);
      if (m > 0 || parts.length === 0) parts.push(`${m} menit`);
      return parts.join(" ");
    };

    // =========================
    // 3. KALKULASI STATISTIK
    // =========================
    let avgResponseGlobal = 0;
    const responseByType = {};

    if (responseTickets.length > 0) {
      let totalMinutesGlobal = 0;

      responseTickets.forEach((t) => {
        const diffMin = Math.max(
          0,
          (new Date(t.respondedAt) - new Date(t.createdAt)) / (1000 * 60),
        );

        // Untuk Global
        totalMinutesGlobal += diffMin;

        // Untuk Detail per Layanan
        if (!responseByType[t.type]) {
          responseByType[t.type] = { totalMin: 0, count: 0 };
        }
        responseByType[t.type].totalMin += diffMin;
        responseByType[t.type].count += 1;
      });

      avgResponseGlobal = totalMinutesGlobal / responseTickets.length;
    }

    // Hasil Akhir untuk dikirim ke Frontend
    const averageResponseTime =
      avgResponseGlobal > 0
        ? formatMinutes(avgResponseGlobal)
        : "Belum ada data";

    const response_time_detail = Object.entries(responseByType)
      .map(([type, data]) => ({
        layanan: type,
        jumlah_permohonan: data.count,
        avg_raw: data.totalMin / data.count,
        avg_response: formatMinutes(data.totalMin / data.count),
      }))
      .sort((a, b) => a.avg_raw - b.avg_raw);

    // =========================
    // RETURN DATA UTAMA SEGERA
    // =========================
    sendResponse(res, 200, "Analytics retrieved", {
      traffic_pengunjung: visitorData,
      traffic_ticket: ticketData,
      jenis_layanan: jenisLayanan,
      status_ticket: statusTicket,
      average_response_time: averageResponseTime,
      response_time_detail,
      visitor_locations: visitorLocations,
      ai_insight: existingInsight ? existingInsight.insight : {},
    });

    // =========================
    // JALANKAN AI HANYA SEKALI PER CACHE KEY
    // =========================
    if (!existingInsight && !global.aiInsightRunning[cacheKey]) {
      global.aiInsightRunning[cacheKey] = true;

      setTimeout(async () => {
        try {
          // Prompt bahasa admin-friendly
          const prompt = `Kamu adalah analis pelayanan publik. 
Tugasmu: buat ringkasan data pengunjung dan layanan dari dashboard PPID Kabupaten Sekadau dengan bahasa yang jelas, mudah dimengerti, dan profesional.
CATATAN: Hindari bahasa programmer misal nya null , dan lainnya. aku mau untuk jam itu kamu convert aja ke dalam bentuk hari jika udh lebih dari 24 jam. untuk status itu jika null maka belum diverifikasi , selesaimaka proses selesai , ditolak maka ditolak , dan diproses maka sedang diproses admin. yaa untuk tiket itu ganti bahasanya jadi Permohonan
Data:
- Pengunjung (maks 50 data pertama): ${JSON.stringify(visitorLocations.slice(0, 50))}
- Layanan tiket: ${JSON.stringify(tickets)}
- Jenis layanan: ${JSON.stringify(jenisLayanan)}
- Status layanan: ${JSON.stringify(statusTicket)}
- Rata-rata waktu respon: ${averageResponseTime}

Buat analisis naratif yang mudah dipahami, meliputi:
1. Tren pengunjung
2. Tren layanan
3. Layanan populer
4. Cara memperoleh informasi populer
5. Profil pemohon
6. Analisis waktu respon
7. Kondisi status layanan
8. Distribusi lokasi pengunjung
9. Dokumen populer
10. Insight utama dan rekomendasi prioritas

Balas hanya dalam format JSON seperti ini:
{
  "trend_pengunjung": "",
  "trend_layanan": "",
  "jenis_layanan_populer": "",
  "cara_memperoleh_populer": "",
  "profil_pemohon": "",
  "analisis_waktu_respon": "",
  "analisis_lokasi_pengunjung": "",
  "dokumen_populer": "",
  "insight": "",
  "rekomendasi": []
}`;

          const result = await model.generateContent(prompt);
          const aiText = await result.response.text();

          let insightJson;
          try {
            const jsonMatch = aiText.match(/\{[\s\S]*\}/);
            insightJson = JSON.parse(jsonMatch[0]);
          } catch {
            insightJson = {
              trend_pengunjung: "Analisis belum tersedia",
              trend_layanan: "Analisis belum tersedia",
              analisis_waktu_respon: "Belum tersedia",
              analisis_lokasi_pengunjung: "Belum tersedia",
              insight: "AI gagal memproses data",
              rekomendasi: [],
            };
          }

          await prisma.aiInsight.updateMany({
            where: { cacheKey },
            data: { status: false },
          });

          await prisma.aiInsight.upsert({
            where: { cacheKey },
            update: {
              insight: insightJson,
              status: true,
              createdAt: new Date(),
            },
            create: { cacheKey, insight: insightJson, status: true },
          });
          console.log("AI insight berhasil disimpan di background");
        } catch (err) {
          console.error("AI background error:", err);
        } finally {
          global.aiInsightRunning[cacheKey] = false;
        }
      }, 0);
    }
  } catch (error) {
    return sendError(res, error, "Failed to fetch analytics");
  }
};

export const GetAIInsightStatus = async (req, res) => {
  try {
    const yearFilter = req.query.year
      ? parseInt(req.query.year)
      : new Date().getFullYear();
    const cacheKey = `insight-${yearFilter}`;

    const insightData = await prisma.aiInsight.findUnique({
      where: { cacheKey },
    });

    if (!insightData) return res.json({ ready: false });

    return res.json({ ready: true, insight: insightData.insight });
  } catch (err) {
    return res.status(500).json({ ready: false, error: err.message });
  }
};
