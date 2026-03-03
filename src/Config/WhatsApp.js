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
      },
    );
    
    console.log("WhatsApp sent successfully");
  } catch (error) {
    console.log("WA Error:", error.message);
  }
};
