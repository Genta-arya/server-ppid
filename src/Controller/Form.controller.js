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
  // Ambil query parameters
  const { type, status, date, page = 1, limit = 10 } = req.query;

  // Cek parameter wajib
  if (!type) {
    return sendError(res, null, "Type parameter is required", 400);
  }

  try {
    const filters = { type: type };

    // 1. Logika Filter Status
    if (status && status.toUpperCase() !== "ALL") {
      filters.status = status.toUpperCase() === "BELUM" ? null : status;
    }

    // 2. Logika Filter Tanggal
    if (date && date.toUpperCase() !== "ALL") {
      const startDate = new Date(date);
      if (!isNaN(startDate.getTime())) {
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        filters.createdAt = { gte: startDate, lte: endDate };
      }
    }

    // 3. Logika Pagination "ALL"
    // Jika limit dikirim sebagai "all" atau angka sangat besar dari frontend (seperti 9999)
    const isExportAll = limit === "all" || parseInt(limit) >= 9000;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = isExportAll ? undefined : (pageNum - 1) * limitNum;
    const take = isExportAll ? undefined : limitNum;

    // 4. Eksekusi Database
    const [forms, totalData] = await Promise.all([
      prisma.ticket.findMany({
        where: filters,
        skip: skip, // Jika undefined, Prisma akan mengabaikan skip
        take: take, // Jika undefined, Prisma akan mengambil semua data
        orderBy: { createdAt: "desc" },
      }),
      prisma.ticket.count({ where: filters }),
    ]);

    // Hitung total halaman (jika export all, total page jadi 1)
    const totalPages = isExportAll ? 1 : Math.ceil(totalData / limitNum);

    return sendResponse(res, 200, "Form data retrieved successfully", {
      data: forms,
      pagination: {
        totalData,
        totalPages,
        currentPage: isExportAll ? 1 : pageNum,
        limit: isExportAll ? totalData : limitNum,
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
  DITOLAK: "Permohonan Belum Dapat Disetujui",
};

const MAP_CARA_MEMPEROLEH = {
  EMAIL: "Dikirim via Email",
  WHATSAPP: "Dikirim via WhatsApp",
  AMBIL_DI_KANTOR: "Diambil Langsung di Kantor PPID",
};

export const updateStatus = async (req, res) => {
  try {
    const {
      id,
      status,
      catatan,
      isNotif,
      id_user = null,
      username = null,
    } = req.body;

    console.log("UpdateStatus Payload:", req.body);

    // 1. Ekstraksi Status dan Data Bukti
    const isStatusObject = typeof status === "object";
    const statusValue = isStatusObject ? status.status : status;
    const buktiUrl = isStatusObject ? status.dokumenUrl : null;
    const buktiName = isStatusObject ? status.dokumenName : null;

    // 2. Siapkan Objek Data untuk Prisma
    const updateData = {
      status: statusValue,
      catatanAdmin: catatan,
      respondedAt: new Date(),
    };

    if (statusValue === "SELESAI") {
      if (buktiUrl) updateData.buktiTerima = buktiUrl;
      if (buktiName) updateData.buktiTerimaName = buktiName;
    } else {
      updateData.buktiTerima = null;
      updateData.buktiTerimaName = null;
    }

    // 3. Update Database
    const form = await prisma.ticket.update({
      where: { id: id },
      data: updateData,
    });

    // 4. Ambil Data untuk Notifikasi
    const {
      email,
      nama,
      ticketNumber,
      caraMemperoleh,
      rincianInformasi,
      tujuanPenggunaan,
      catatanAdmin,
      buktiTerima,
    } = form;

    const statusTerpilih = MAP_STATUS_USER[statusValue] || statusValue;
    const teksCaraMemperoleh = MAP_CARA_MEMPEROLEH[caraMemperoleh] || "-";

    // 5. Logika Pesan Dinamis & Penanganan Bukti
    let deskripsiStatus = "";
    let htmlBukti = "";

    if (statusValue === "DIPROSES") {
      deskripsiStatus = `Permohonan PPID Anda sedang dalam tahap verifikasi dan pengolahan data oleh tim kami.`;
    } else if (statusValue === "SELESAI") {
      deskripsiStatus = `Permohonan informasi Anda telah <strong>SELESAI</strong> diproses. Informasi akan disampaikan sesuai pilihan Anda yaitu melalui: <strong>${teksCaraMemperoleh}</strong>.`;

      if (buktiTerima) {
        htmlBukti = `
          <div style="margin-top: 20px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase;">Lampiran Bukti / Dokumen:</p>
            <a href="${buktiTerima}" style="color: #900D0D; font-weight: bold; text-decoration: none; font-size: 14px; border-bottom: 2px solid #900D0D;">
               Klik Untuk Lihat Dokumen Informasi
            </a>
          </div>`;
      }
    } else if (statusValue === "DITOLAK") {
      deskripsiStatus = `Mohon maaf, permohonan Anda belum dapat dipenuhi karena alasan berikut: <br/> 
      <em style="color: #dc2626; font-weight: bold;">"${catatanAdmin || "Terdapat ketidaksesuaian data pada berkas."}"</em>`;
    }

    // 6. Kirim Email dengan Template Konsisten
    if (isNotif) {
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
                      <h1 style="margin:0;font-size:20px;color:#ffffff;">Sistem Pelayanan PPID</h1>
                      <p style="margin:6px 0 0 0;font-size:14px;color:#f3f4f6;">Komisi Pemilihan Umum Kabupaten Sekadau</p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:32px;color:#374151;font-size:14px;line-height:1.6;">
                      <p style="margin:0 0 16px 0;">Yth. <strong>${nama}</strong>,</p>
                      <p style="margin:0 0 20px 0;">${deskripsiStatus}</p>

                      <div style="background:#fff5f5;padding:18px;border-radius:8px;text-align:center;margin-bottom:28px;border:1px solid #f3d1d1;">
                        <p style="margin:0;font-size:11px;color:#7f1d1d;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">STATUS SAAT INI</p>
                        <p style="margin:10px 0 0 0;font-size:22px;font-weight:bold;color:#900D0D;">${statusTerpilih.toUpperCase()}</p>
                        <p style="margin:5px 0 0 0;font-size:12px;color:#6b7280;">No. Tiket: ${ticketNumber}</p>
                      </div>

                      ${htmlBukti}

                      <table width="100%" cellpadding="6" style="font-size:13px;margin-top:20px;">
                        <tr>
                          <td style="padding-top: 15px;">
                            <strong>Rincian Informasi:</strong><br />
                            <div style="margin-top: 5px; color: #4b5563;">${rincianInformasi}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-top: 10px;">
                            <strong>Tujuan Penggunaan:</strong><br />
                            <div style="margin-top: 5px; color: #4b5563;">${tujuanPenggunaan}</div>
                          </td>
                        </tr>
                      </table>

                      <div style="text-align:center;margin:30px 0;">
                        <a href="https://beta-ppid-kab-sekadau.vercel.app/ticket?id=${ticketNumber}" 
                           style="background:#900D0D;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;display:inline-block;font-weight:bold;">
                           Cek Status Pengajuan
                        </a>
                      </div>

                      <p style="margin:0;">Hormat kami,<br/><strong>Tim PPID KPU Kabupaten Sekadau</strong></p>
                      <p style="margin:5px 0 0 0; color:#900D0D; font-weight:bold;">#TemanPemilih</p>
                    </td>
                  </tr>

                  <tr>
                    <td style="background:#f9fafb;padding:16px;text-align:center;font-size:11px;color:#9ca3af;">
                      Email ini dikirim secara otomatis oleh Sistem PPID KPU Kabupaten Sekadau. <br/>
                      &copy; ${new Date().getFullYear()} KPU Sekadau. Mohon tidak membalas email ini.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        `,
      );
    }

    // 7. Log Aktivitas
    await prisma.log.create({
      data: {
        id_user: id_user,
        username: username,
        TicketId: form.ticketNumber,
        action: `Update status permohonan`,
        message: `Update status ${ticketNumber} menjadi ${statusTerpilih}`,
      },
    });

    return sendResponse(res, 200, "Update status berhasil", form);
  } catch (error) {
    console.error("updateStatus Error:", error);
    return sendError(res, error, "Gagal memperbarui status");
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

export const GetAllLog = async (req, res) => {
  try {
    // 1. Ambil query parameter dan konversi ke integer
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // 2. Hitung jumlah data yang harus dilewati (offset)
    const skip = (page - 1) * limit;

    // 3. Jalankan query secara paralel untuk efisiensi (opsional tapi disarankan)
    const [response, total] = await Promise.all([
      prisma.log.findMany({
        skip: skip,      // Melewati data sebelumnya
        take: limit,     // Mengambil jumlah data sesuai limit
        orderBy: {
          createdAt: 'desc', // Biasanya log ingin melihat yang terbaru dulu
        },
      }),
      prisma.log.count(), // Menghitung total seluruh record
    ]);

    // 4. Logika Paginasi
    const totalPages = Math.ceil(total / limit);
    const hasPrevPage = page > 1;
    const hasNextPage = page < totalPages;

    const pagination = {
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
      hasPrevPage: hasPrevPage,
      hasNextPage: hasNextPage,
      prevPage: hasPrevPage ? page - 1 : null,
      nextPage: hasNextPage ? page + 1 : null,
    };

    return sendResponse(res, 200, "Log data retrieved successfully", {
      response,
      pagination,
    });
  } catch (error) {
    console.log("GetAllLog Error:", error);
    // Pastikan sendError sudah terdefinisi di helper kamu
    sendError(res, error, "Failed to retrieve log data");
  }
};