const express = require("express");
const router = express.Router();

const { createUser } = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");

/**
 * @route  POST /admin/create-user
 * @access Protected – admin only
 * @desc   Create a new caretaker, warden, or dean account
 */
router.post("/create-user", protect, checkRole("admin"), createUser);

module.exports = router;
