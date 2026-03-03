import axios from "axios";
import { sendEmail } from "../Config/Mailer.js";
import { prisma } from "../Config/Prisma.js";
import { sendWhatsapp } from "../Config/WhatsApp.js";
import { google } from "googleapis";

import { sendError, sendResponse } from "../Utils/Response.js";

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

    sendWhatsapp(
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

📝 Rincian Informasi:
${rincianInformasi}

🎯 Tujuan Penggunaan:
${tujuanPenggunaan}

━━━━━━━━━━━━━━━━━━
Segera lakukan verifikasi dan tindak lanjut.

🔗 Cek Detail:
https://beta-ppid-kab-sekadau.vercel.app/ticket?id=${ticketNumber}`,
    );

    // ==============================
    // 🔥 SEND EMAIL NOTIFICATION
    // ==============================

    sendEmail(
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
