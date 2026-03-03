import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "mail.kpu-sekadau.my.id",
  port: 465,
  secure: true, // WAJIB true karena port 465
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"System PPID" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent successfully");
  } catch (error) {
    console.log("Email Error:", error.message);
  }
};
