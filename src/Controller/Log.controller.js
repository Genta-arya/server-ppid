import { prisma } from "../Config/Prisma";
import { sendError, sendResponse } from "../Utils/Response";

export const GetAllLog = async (req, res) => {
  try {
    const logs = await prisma.log.findMany();
    sendResponse(res, 200, "Logs retrieved successfully", logs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    sendError(res, 500, "An error occurred while fetching logs", error);
  }
};
