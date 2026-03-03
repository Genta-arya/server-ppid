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
