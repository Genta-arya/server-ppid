import { prisma } from "../Config/Prisma.js";
import { sendError, sendResponse } from "../Utils/Response.js";

export const getNotification = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany();
    return sendResponse(
      res,
      200,
      "Notifications retrieved successfully",
      notifications,
    );
  } catch (error) {
    console.log("getNotification Error:", error);
    return sendError(res, error, "Failed to retrieve notifications");
  }
};
