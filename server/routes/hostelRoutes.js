const express = require("express");
const router = express.Router();

const { createHostel, getAllHostels } = require("../controllers/hostelController");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");

/**
 * @route  POST /hostel/create
 * @access Protected - admin only
 */
router.post("/create", protect, checkRole("admin"), createHostel);

/**
 * @route  GET /hostel/all
 * @access Protected - admin, dean, warden
 */
router.get("/all", protect, checkRole("admin", "dean", "warden"), getAllHostels);

module.exports = router;
