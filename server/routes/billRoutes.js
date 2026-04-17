const express = require("express");
const router = express.Router();

const {
  generateBills,
  getAllBillsByMonth,
  getBillBreakdownByMonth,
  getStudentBill,
  getStudentBillHistory,
  getMessBillReportByMonth,
  generateMessBillReport,
  submitMessBillReport,
  approveMessBillReportByWarden,
  approveMessBillReportByDean,
  getBillConfig,
  upsertBillConfig,
  updateStudentPaymentDetails,
} = require("../controllers/messController");
const { generateBillPDF, generateMonthlyMessBillBreakdownPDF } = require("../controllers/pdfController");
const { protect } = require("../middleware/authMiddleware");
const { checkRole } = require("../middleware/roleMiddleware");

/**
 * @route  POST /bill/generate/:month
 * @access Protected – caretaker only
 * @desc   Generate mess bills for all active students in the caretaker's hostel
 *         for the given month. Prevents duplicate generation.
 *
 * Param: month (string, "Mon-YYYY" format, e.g. "Jan-2026")
 */
router.post(
  "/generate/:month",
  protect,
  checkRole("caretaker"),
  generateBills
);

router.get(
  "/config/:month",
  protect,
  checkRole("caretaker", "admin", "dean", "warden"),
  getBillConfig
);

router.put(
  "/config/:month",
  protect,
  checkRole("caretaker"),
  upsertBillConfig
);

/**
 * @route  GET /bill/all/:month
 * @access Protected – caretaker or admin
 * @desc   Retrieve all bills for a given month.
 *         Caretakers see only their hostel's bills.
 *         Admins see all hostels' bills.
 *
 * Param: month (string, "Mon-YYYY" format)
 */
router.get(
  "/all/:month",
  protect,
  checkRole("caretaker", "admin"),
  getAllBillsByMonth
);

router.get(
  "/breakdown/:month",
  protect,
  checkRole("caretaker", "admin", "dean", "warden"),
  getBillBreakdownByMonth
);

router.get(
  "/report/status/:month",
  protect,
  checkRole("caretaker", "admin", "dean", "warden"),
  getMessBillReportByMonth
);

router.post(
  "/report/generate/:month",
  protect,
  checkRole("caretaker"),
  generateMessBillReport
);

router.put(
  "/report/submit/:month",
  protect,
  checkRole("caretaker"),
  submitMessBillReport
);

router.put(
  "/report/warden-approve/:month",
  protect,
  checkRole("warden"),
  approveMessBillReportByWarden
);

router.put(
  "/report/dean-approve/:month",
  protect,
  checkRole("admin", "dean"),
  approveMessBillReportByDean
);

/**
 * @route  GET /bill/student/:studentId/:month
 * @access Protected – student (own bill), caretaker (all), admin (all)
 * @desc   Retrieve a specific student's bill for a given month.
 *         Students can only access their own bill.
 *         Caretakers and admins can access any student's bill.
 *
 * Params:
 *   studentId (string) – Student document _id
 *   month (string, "Mon-YYYY" format)
 */
router.get(
  "/history/:studentId",
  protect,
  getStudentBillHistory
);

router.get(
  "/student/:studentId/:month",
  protect,
  getStudentBill
);

router.put(
  "/payment-info/:billId",
  protect,
  checkRole("student"),
  updateStudentPaymentDetails
);

router.get(
  "/pdf/:studentId/:month",
  protect,
  generateBillPDF
);

router.get(
  "/report/pdf/:month",
  protect,
  checkRole("caretaker", "admin", "dean", "warden"),
  generateMonthlyMessBillBreakdownPDF
);

module.exports = router;
