import axios from "axios";
import { sendEmail } from "../Config/Mailer.js";
import { prisma } from "../Config/Prisma.js";
import { sendWhatsapp } from "../Config/WhatsApp.js";
import { google } from "googleapis";

import { sendError, sendResponse } from "../Utils/Response.js";
import pusher from "../Config/Pusher.js";
import { sendSSEntNotification } from "./SSE.js";

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: "service_account",
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
  },
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });
export const DownloadFile = async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return sendError(res, null, "Nomor registrasi wajib diisi", 400);
    }

    const ticket = await prisma.ticket.findFirst({
      where: { ticketNumber: id },
    });

    if (!ticket || !ticket.dokumenUrl) {
      return sendError(res, null, "File tidak ditemukan", 404);
    }

    const fileIdMatch = ticket.dokumenUrl.match(/[-\w]{25,}/);
    if (!fileIdMatch) {
      return sendError(res, null, "File ID tidak valid", 400);
    }

    const fileId = fileIdMatch[0];

    // 🔥 Ambil metadata dulu
    const meta = await drive.files.get({
      fileId,
      fields: "name,mimeType",
    });

    // 🔥 Stream file
    const fileStream = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" },
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${meta.data.name}"`,
    );

    res.setHeader("Content-Type", meta.data.mimeType);

    fileStream.data.pipe(res);
  } catch (error) {
    console.log("Drive Download Error:", error.message);
    return sendError(res, error, "Gagal mengunduh file");
  }
};

export const PostForm = async (req, res) => {
  console.log("FONNTE:", process.env.FONNTE_TOKEN);
  //
  console.log("MAIL_USER:", process.env.MAIL_USER);
  try {
    const {
      type,
      jenisPemohon,
      nama,
      email,
      telepon,
      pendidikan,
      pekerjaan,
      alamat,
      caraMemperoleh,
      jenisIdentitas,
      nomorIdentitas,
      rincianInformasi,
      tujuanPenggunaan,
      dokumenUrl,
      dokumenName,
      agree,
    } = req.body;

    // 🔥 VALIDASI REQUIRED
    const requiredFields = {
      type,
      jenisPemohon,
      nama,
      email,
      telepon,
      pendidikan,
      pekerjaan,
      caraMemperoleh,
      alamat,
      jenisIdentitas,
      nomorIdentitas,
      rincianInformasi,
      tujuanPenggunaan,
    };

    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value || value.toString().trim() === "") {
        return sendError(res, null, `${key} is required`, 400);
      }
    }

    if (!agree) {
      return sendError(res, null, "Anda harus menyetujui pernyataan", 400);
    }

    // 🔥 Validasi Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, null, "Format email tidak valid", 400);
    }

    // ==============================
    // 🔥 GENERATE TICKET NUMBER
    // ==============================

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    const todayStart = new Date(year, now.getMonth(), now.getDate());
    const todayEnd = new Date(year, now.getMonth(), now.getDate() + 1);

    const countToday = await prisma.ticket.count({
      where: {
        createdAt: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    const runningNumber = String(countToday + 1).padStart(4, "0");
    const prefix = type === "KEBERATAN" ? "KBR" : "INF";
    const ticketNumber = `${prefix}-${year}${month}${day}-${runningNumber}`;

    // ==============================
    // 🔥 SAVE TO DATABASE
    // ==============================

    const newTicket = await prisma.ticket.create({
      data: {
        type,
        ticketNumber,
        jenisPemohon,
        nama,
        email,
        telepon,
        pendidikan,
        pekerjaan,
        alamat,
        jenisIdentitas,
        caraMemperoleh,
        nomorIdentitas,
        rincianInformasi,
        tujuanPenggunaan,
        dokumenUrl,
        dokumenName,
        agree,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    // ==============================
    // 🔥 SEND WHATSAPP NOTIFICATION
    // ==============================

    const noAdmin = await prisma.dataAdmin.findFirst();
    const MAP_CARA_MEMPEROLEH = {
      EMAIL: "Dikirim via Email",
      WHATSAPP: "Dikirim via WhatsApp",
      AMBIL_DI_KANTOR: "Diambil Langsung di Kantor PPID",
    };
    const teksCaraMemperoleh = MAP_CARA_MEMPEROLEH[caraMemperoleh] || "-";

    await sendWhatsapp(
      noAdmin.noHp,
      `🔔 NOTIFIKASI PERMOHONAN PPID BARU

📌 Nomor Registrasi:
${ticketNumber}

👤 Nama Pemohon:
${nama}

📂 Jenis Permohonan:
${type === "KEBERATAN" ? "Pengajuan Keberatan Informasi" : "Permohonan Informasi Publik"}

📧 Email:
${email}

📱 Telepon:
${telepon}

🔎 cara Memperoleh Informasi:
${teksCaraMemperoleh}

📝 Rincian Informasi:
${rincianInformasi}

🎯 Tujuan Penggunaan:
${tujuanPenggunaan}


Segera lakukan verifikasi dan tindak lanjut.

🔗 Cek Detail:
https://beta-ppid-kab-sekadau.vercel.app/ticket?id=${ticketNumber}`,
    );

    // ==============================
    // 🔥 SEND EMAIL NOTIFICATION
    // ==============================

    await sendEmail(
      email,
      "Nomor Registrasi Permohonan PPID",
      `
 <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0" 
          style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);">

          <!-- HEADER MERAH KPU -->
          <tr>
            <td style="background:#900D0D;padding:28px;text-align:center;">
              <img 
                src="https://sekadaukabppid.kpu.go.id/img/logo.png" 
                alt="Logo KPU" 
                width="80" 
                style="display:block;margin:0 auto 12px auto;"
              />
              <h1 style="margin:0;font-size:20px;color:#ffffff;">
                Sistem Pelayanan PPID
              </h1>
              <p style="margin:6px 0 0 0;font-size:14px;color:#f3f4f6;">
                Komisi Pemilihan Umum Kabupaten Sekadau
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:32px;color:#374151;font-size:14px;line-height:1.6;">

              <p style="margin:0 0 16px 0;">
                Yth. <strong>${nama}</strong>,
              </p>

              <p style="margin:0 0 20px 0;">
                Permohonan PPID yang Anda ajukan telah berhasil diterima dan sedang diproses.
              </p>

              <!-- BOX NOMOR REGISTRASI -->
              <div style="background:#fff5f5;padding:18px;border-radius:8px;text-align:center;margin-bottom:28px;border:1px solid #f3d1d1;">
                <p style="margin:0;font-size:12px;color:#7f1d1d;">
                  NOMOR REGISTRASI
                </p>
                <p style="margin:10px 0 0 0;font-size:20px;font-weight:bold;color:#900D0D;letter-spacing:1px;">
                  ${ticketNumber}
                </p>
              </div>

              <table width="100%" cellpadding="6" style="font-size:14px;margin-bottom:20px;">
<tr>
  <td colspan="2" style="padding-top: 10px;">
    <strong>Cara Memperoleh Informasi:</strong><br />
    <div style="margin-top: 5px; color: #333;">${teksCaraMemperoleh}</div>
  </td>
</tr>

<tr>
  <td colspan="2" style="padding-top: 10px;">
    <strong>Rincian Informasi:</strong><br />
    <div style="margin-top: 5px; color: #333; line-height: 1.5;">${rincianInformasi}</div>
  </td>
</tr>

<tr>
  <td colspan="2" style="padding-top: 10px;">
    <strong>Tujuan Penggunaan:</strong><br />
    <div style="margin-top: 5px; color: #333; line-height: 1.5;">${tujuanPenggunaan}</div>
  </td>
</tr>
</table>

              <!-- BUTTON MERAH -->
              <div style="text-align:center;margin-bottom:24px;">
                <a 
                  href="https://beta-ppid-kab-sekadau.vercel.app/ticket?id=${ticketNumber}" 
                  style="background:#900D0D;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;display:inline-block;">
                  Cek Status Pengajuan
                </a>
              </div>

              <p style="margin:0;">
                Silakan klik tombol di atas untuk melihat perkembangan permohonan Anda.
              </p>

              <br/>

              <p style="margin:0;">
                Hormat kami,<br/>
                <strong>Tim PPID KPU Kabupaten Sekadau</strong>
              </p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#6b7280;">
              Email ini dikirim secara otomatis oleh Sistem PPID KPU Kabupaten Sekadau.
              <br/>
              Mohon tidak membalas email ini.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
  `,
    );

    // try {
    //   // 1. Simpan ke Database dulu
    //   const newNotif = await prisma.notification.create({
    //     data: {
    //       message: `Ada permohonan ${type.toLowerCase()} baru dari ${nama}`,
    //       ticketNumber: ticketNumber,
    //       type: type,
    //     },
    //   });

    //   // 2. Kirim ke Pusher (Gunakan data dari DB agar ID-nya sinkron)
    //   await pusher.trigger("admin-notification", "new-permohonan", {
    //     id: newNotif.id, // ID asli dari DB
    //     message: newNotif.message,
    //     ticketNumber: newNotif.ticketNumber,
    //     type: newNotif.type,
    //     createdAt: newNotif.createdAt,
    //   });

    //   console.log("Notifikasi disimpan dan dikirim via Pusher.");
    // } catch (error) {
    //   console.error("Gagal memproses notifikasi:", error);
    // }

    try {
      // 1. Simpan ke Database (Tetap sama)
      const newNotif = await prisma.notification.create({
        data: {
          message: `Ada permohonan ${type === "PERMINTAAN_INFORMASI" ? "Permohonan Informasi" : "Pengajuan Keberatan"} baru dari ${nama}`,
          ticketNumber: ticketNumber,
          type: type,
        },
      });

      // 2. Kirim ke SSE (Ganti Pusher)
      // Kita panggil fungsi helper yang mengirimkan data ke semua admin yang sedang online
      sendSSEntNotification({
        id: newNotif.id,
        message: newNotif.message,
        ticketNumber: newNotif.ticketNumber,
        type: newNotif.type,
        createdAt: newNotif.createdAt,
      });

      console.log("Notifikasi disimpan dan disiarkan via SSE.");
    } catch (error) {
      console.error("Gagal memproses notifikasi:", error);
    }

    return sendResponse(res, 201, "Form data submitted successfully", {
      ticketNumber: newTicket.ticketNumber,
    });
  } catch (error) {
    return sendError(res, error, "Failed to submit form data");
  }
};

export const GetDetailForm = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return sendError(res, null, "ID parameter is required", 400);
    }
    const form = await prisma.ticket.findFirst({ where: { ticketNumber: id } });
    if (!form) {
      return sendResponse(res, 404, "Form data not found", null);
    }

    return sendResponse(res, 200, "Form data retrieved successfully", form);
  } catch (error) {
    console.log("GetDetailForm Error:", error);
    return sendError(res, error, "Failed to retrieve form data");
  }
};

export const GetAllForm = async (req, res) => {
  // Tambahkan page dan limit dari query, beri nilai default
  const { type, status, date, page = 1, limit = 10 } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  if (!type) {
    return sendError(res, null, "Type parameter is required", 400);
  }

  try {
    const filters = { type: type };

    if (status && status.toUpperCase() !== "ALL") {
      filters.status = status.toUpperCase() === "BELUM" ? null : status;
    }

    if (date && date.toUpperCase() !== "ALL") {
      const startDate = new Date(date);
      if (!isNaN(startDate.getTime())) {
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        filters.createdAt = { gte: startDate, lte: endDate };
      }
    }

    // Ambil data dengan pagination dan hitung total sekaligus
    const [forms, totalData] = await Promise.all([
      prisma.ticket.findMany({
        where: filters,
        skip: skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
      prisma.ticket.count({ where: filters }),
    ]);

    const totalPages = Math.ceil(totalData / limitNum);

    return sendResponse(res, 200, "Form data retrieved successfully", {
      data: forms,
      pagination: {
        totalData,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
        totalData: totalData,
      },
    });
  } catch (error) {
    console.log("GetAllForm Error:", error);
    return sendError(res, error, "Failed to retrieve form data");
  }
};

// --- MAPPING HELPERS ---
const MAP_STATUS_USER = {
  DIPROSES: "Sedang Diproses",
  SELESAI: "Permohonan Selesai / Disetujui",
  DITOLAK: "Permohonan Belum Dapat Dikabulkan",
};

const MAP_CARA_MEMPEROLEH = {
  EMAIL: "Dikirim via Email",
  WHATSAPP: "Dikirim via WhatsApp",
  AMBIL_DI_KANTOR: "Diambil Langsung di Kantor PPID",
};

export const updateStatus = async (req, res) => {
  try {
    const { id, status } = req.body;
    
    // Handle jika status dikirim dalam bentuk object atau string
    const statusValue = typeof status === "object" ? status.status : status;

    // 1. Update Database
    const form = await prisma.ticket.update({
      where: { id: id },
      data: {
        status: statusValue,
        respondedAt: new Date(),
      },
    });

    // 2. Destructuring Data dari hasil update
    const {
      email,
      nama,
      ticketNumber,
      caraMemperoleh,
      rincianInformasi,
      tujuanPenggunaan,
      catatanAdmin,
    } = form;

    const statusTerpilih = MAP_STATUS_USER[statusValue] || statusValue;
    const teksCaraMemperoleh = MAP_CARA_MEMPEROLEH[caraMemperoleh] || "-";

    // 3. Logika Pesan Dinamis #TemanPemilih
    let pesanTambahan = "";
    if (statusValue === "DIPROSES") {
      pesanTambahan = `Halo <strong>#TemanPemilih</strong>, permohonan informasi Anda saat ini sedang dalam tahap verifikasi dan pengolahan data oleh tim kami. Mohon kesediaannya untuk menunggu proses lebih lanjut.`;
    } else if (statusValue === "SELESAI") {
      pesanTambahan = `Halo <strong>#TemanPemilih</strong>, permohonan informasi Anda telah selesai diproses. Dokumen atau informasi yang Anda minta akan kami teruskan dengan cara: <strong>${teksCaraMemperoleh}</strong>.`;
    } else if (statusValue === "DITOLAK") {
      pesanTambahan = `Halo <strong>#TemanPemilih</strong>, mohon maaf, permohonan Anda belum dapat kami penuhi saat ini karena alasan berikut: <br/> <em style="color: #dc2626; font-weight: bold;">"${catatanAdmin || "Terdapat ketidaksesuaian data pada berkas yang dikirimkan."}"</em>`;
    }

    // 4. Kirim Email
    await sendEmail(
      email,
      `Update Status Permohonan PPID - ${ticketNumber}`,
      `
      <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);">
                <tr>
                  <td style="background:#900D0D;padding:28px;text-align:center;">
                    <img src="https://sekadaukabppid.kpu.go.id/img/logo.png" alt="Logo KPU" width="80" style="display:block;margin:0 auto 12px auto;" />
                    <h1 style="margin:0;font-size:20px;color:#ffffff;letter-spacing:1px;">Sistem Pelayanan PPID</h1>
                    <p style="margin:6px 0 0 0;font-size:14px;color:#f3f4f6;">KPU Kabupaten Sekadau</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:32px;color:#374151;font-size:15px;line-height:1.6;">
                    <p style="margin:0 0 16px 0;">Yth. <strong>${nama}</strong>,</p>
                    
                    <div style="text-align:center; margin: 30px 0; padding: 20px; border: 1px dashed #d1d5db; border-radius: 8px;">
                      <p style="margin:0; color:#6b7280; font-size:12px; text-transform:uppercase; letter-spacing:2px;">Status Permohonan</p>
                      <p style="margin:8px 0 0 0; color:#900D0D; font-size:20px; font-weight:bold;">
                        "${statusTerpilih.toUpperCase()}"
                      </p>
                    </div>

                    <div style="background:#fff7ed; padding:20px; border-radius:8px; margin-bottom:25px; border-left:4px solid #f97316; color: #7c2d12;">
                       ${pesanTambahan}
                    </div>

                    <div style="background:#f3f4f6;padding:18px;border-radius:8px;text-align:center;margin-bottom:28px;">
                      <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;">Nomor Registrasi</p>
                      <p style="margin:5px 0 0 0;font-size:22px;font-weight:bold;color:#111827;">${ticketNumber}</p>
                    </div>

                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:20px; color:#4b5563;">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                          <strong>Rincian Informasi:</strong><br />
                          <div style="margin-top: 4px; color: #1f2937;">${rincianInformasi}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <strong>Tujuan Penggunaan:</strong><br />
                          <div style="margin-top: 4px; color: #1f2937;">${tujuanPenggunaan}</div>
                        </td>
                      </tr>
                    </table>

                    <div style="text-align:center;margin:30px 0;">
                      <a href="https://beta-ppid-kab-sekadau.vercel.app/ticket?id=${ticketNumber}" 
                         style="background:#900D0D;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:6px;font-size:14px;display:inline-block;font-weight:bold;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                        Pantau Progress Permohonan
                      </a>
                    </div>
                    
                    <p style="margin:0;">Salam hormat,<br/><strong>Tim PPID KPU Kabupaten Sekadau</strong></p>
                    <p style="margin:10px 0 0 0; color:#900D0D; font-weight:bold;">#TemanPemilih</p>
                  </td>
                </tr>

                <tr>
                  <td style="background:#f9fafb;padding:20px;text-align:center;font-size:12px;color:#9ca3af; border-top: 1px solid #f3f4f6;">
                    &copy; ${new Date().getFullYear()} KPU Kabupaten Sekadau. <br/>
                    Alamat: Jl. Merdeka Barat, Sekadau, Kalimantan Barat.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      `
    );

    return sendResponse(res, 200, "Update berhasil & Email terkirim", form);
  } catch (error) {
    console.error("updateStatus Error:", error);
    return sendError(res, error, "Gagal memperbarui status permohonan");
  }
};

export const deleteForm = async (req, res) => {
  try {
    const { id } = req.body;
    console.log(id);
    const form = await prisma.ticket.delete({ where: { id: id } });
    return sendResponse(res, 200, "Form data deleted successfully", form);
  } catch (error) {
    console.log("deleteForm Error:", error);
    return sendError(res, error, "Failed to delete form data");
  }
};
