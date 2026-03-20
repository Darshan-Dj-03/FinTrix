const express = require("express");
const router = express.Router();

const {
  addStudent,
  getAllStudents,
  updateStudent,
} = require("../controllers/studentController");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");

/**
 * @route  POST /student/add
 * @access Protected – admin only
 * @desc   Create a new student (User + Student profile in one call)
 */
router.post("/add", protect, checkRole("admin"), addStudent);

/**
 * @route  GET /student/all
 * @access Protected – admin or caretaker
 * @desc   Retrieve all student profiles with populated user data
 */
router.get("/all", protect, checkRole("admin", "caretaker"), getAllStudents);

/**
 * @route  PATCH /student/update/:id
 * @access Protected – admin or caretaker
 * @desc   Update gender, isEBL, or isActive for a student
 *         :id = Student document _id
 */
router.patch(
  "/update/:id",
  protect,
  checkRole("admin", "caretaker"),
  updateStudent
);

module.exports = router;
