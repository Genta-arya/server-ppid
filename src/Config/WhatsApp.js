import axios from "axios";
import { sendResponse } from "../Utils/Response.js";

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
    sendResponse(null, 200, "WhatsApp sent successfully");
  } catch (error) {
    console.log("WA Error:", error.message);
    sendResponse(null, 500, "Failed to send WhatsApp");
  }
};
