const express = require("express");
const router = express.Router();

const { createUser } = require("../controllers/adminController");
const {
  createManagedUser,
  listUsers,
  updateManagedUser,
} = require("../controllers/adminUsersController");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");

/**
 * @route  POST /admin/create-user
 * @access Protected – admin only
 * @desc   Create a new caretaker, warden, or dean account
 */
router.post("/create-user", protect, checkRole("admin"), createUser);
router.post("/users", protect, checkRole("admin"), createManagedUser);
router.get("/users", protect, checkRole("admin"), listUsers);
router.patch("/users/:id", protect, checkRole("admin"), updateManagedUser);

module.exports = router;
