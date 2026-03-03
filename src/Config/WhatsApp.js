import axios from "axios";

export const sendWhatsapp = async (to, message) => {
  try {
    await axios.post(
      "https://api.fonnte.com/send",
      {
        target: to,
        message: message,
      },
      {
        headers: {
          Authorization: process.env.FONNTE_TOKEN,
        },
      }
    );
  } catch (error) {
    console.log("WA Error:", error.message);
  }
};