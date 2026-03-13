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

export const markAsRead = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return sendError(res, null, "ID parameter is required", 400);
  }
  try {
    await prisma.notification.update({
      where: { id: id },
      data: { isRead: true },
    });
    res.json({ message: "Updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteAll = async (req, res) => {
  try {
    await prisma.notification.deleteMany({}); // Hapus semua
    res.json({ message: "All notifications cleared" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const readAll = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
