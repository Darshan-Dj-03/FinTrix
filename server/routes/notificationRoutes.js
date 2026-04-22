const express = require("express");
const { param } = require("express-validator");

const { protect } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");
const {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notificationController");

const router = express.Router();

router.get("/", protect, listNotifications);
router.put("/read-all", protect, markAllNotificationsRead);
router.put(
  "/:id/read",
  protect,
  [param("id").isMongoId().withMessage("Invalid notification id")],
  validateRequest,
  markNotificationRead
);

module.exports = router;
