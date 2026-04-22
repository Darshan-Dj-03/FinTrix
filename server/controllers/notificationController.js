const Notification = require("../models/Notification");
const logger = require("../utils/logger");

const listNotifications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 50);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ userId: req.user._id, readAt: null }),
    ]);

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    logger.error("List notifications error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error("Mark notification read error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        userId: req.user._id,
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (error) {
    logger.error("Mark all notifications read error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
