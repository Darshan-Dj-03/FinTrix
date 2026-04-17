const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const MessBill = require("../models/MessBill");
const Student = require("../models/Student");
const Ledger = require("../models/Ledger");
const { notifyStudentPaymentRecorded } = require("../services/notificationService");
const { DEFAULT_UTR_MESSAGE, applyLiveBillState } = require("../services/billLifecycleService");
const { runInTransaction } = require("../utils/transaction");
const { createAuditLog } = require("../services/auditService");
const { getPagination, buildPaginationMeta } = require("../utils/pagination");
const logger = require("../utils/logger");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;
const buildBillPaymentKey = (billId) => `bill:${String(billId)}`;

const populatePayment = [
  { path: "studentId", select: "studentId gender isEBL isActive", populate: { path: "userId", select: "name" } },
  { path: "billId", select: "month total_amount fine payment_status amount_paid due_date hostelId" },
  { path: "hostelId", select: "name type location" },
  { path: "verifiedBy", select: "name username role hostelId" },
];

const isOperationalStudent = (student) =>
  Boolean(
    student &&
      student.isActive !== false &&
      student.userId &&
      student.userId.isActive !== false
  );

const isOperationalPayment = (payment) => isOperationalStudent(payment?.studentId);

const ensureBillAccess = async (billId, user) => {
  if (!mongoose.Types.ObjectId.isValid(billId)) {
    return { error: "Invalid billId format.", status: 400 };
  }

  const bill = await MessBill.findById(billId).populate([
    { path: "studentId", select: "studentId userId isActive", populate: { path: "userId", select: "isActive" } },
    { path: "userId", select: "name username hostelId email isActive" },
  ]);

  if (!bill) {
    return { error: "Bill not found.", status: 404 };
  }

  if (!isOperationalStudent(bill.studentId)) {
    return { error: "Bill not found.", status: 404 };
  }

  if (user.role === "caretaker" && String(bill.hostelId) !== String(user.hostelId)) {
    return { error: "You can only manage bills for your hostel.", status: 403 };
  }

  if (user.role === "student" && String(bill.userId._id) !== String(user._id)) {
    return { error: "You can only access your own bill.", status: 403 };
  }

  return { bill };
};

const recordPayment = async (req, res) => {
  try {
    const { billId, paymentMethod = "upi", paymentMadeDate } = req.body;
    const idempotencyKey = req.get("X-Idempotency-Key") || req.body.idempotencyKey || "";

    if (!billId || !mongoose.Types.ObjectId.isValid(billId)) {
      return res.status(400).json({ success: false, message: "Valid billId is required." });
    }

    const access = await ensureBillAccess(billId, req.user);
    if (access.error) {
      return res.status(access.status).json({ success: false, message: access.error });
    }

    const bill = access.bill;
    const billPaymentKey = buildBillPaymentKey(bill._id);
    const payableTotal = Number(applyLiveBillState(bill).total_payable || 0);
    const outstandingBefore = Math.max(payableTotal - Number(bill.amount_paid || 0), 0);

    if (outstandingBefore <= 0) {
      const latestPayment = await Payment.findOne({ billId }).sort({ createdAt: -1 }).populate(populatePayment);
      return res.status(200).json({
        success: true,
        message: "Bill is already fully paid.",
        data: latestPayment,
      });
    }

    if (!["cash", "upi"].includes(String(paymentMethod).toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "paymentMethod must be either cash or upi.",
      });
    }

    const normalizedRequestedMethod = String(paymentMethod).toLowerCase();
    const requestedBillUtr = String(bill.student_utr_number || "").trim();
    if (normalizedRequestedMethod === "upi" && !requestedBillUtr) {
      return res.status(400).json({
        success: false,
        message: "Student UTR is required before recording a UPI payment.",
      });
    }

    const result = await runInTransaction(async (session) => {
      if (idempotencyKey) {
        const existingPayment = await Payment.findOne({ idempotencyKey })
          .session(session)
          .populate(populatePayment);

        if (existingPayment) {
          return { payment: existingPayment, alreadyProcessed: true };
        }
      }

      const existingBillPayment = await Payment.findOne({ billPaymentKey })
        .session(session)
        .populate(populatePayment);

      if (existingBillPayment) {
        return { payment: existingBillPayment, alreadyProcessed: true };
      }

      const transactionalBill = await MessBill.findById(billId).session(session);
      if (!transactionalBill) {
        const error = new Error("Bill not found.");
        error.status = 404;
        throw error;
      }

      const liveBillState = applyLiveBillState(transactionalBill);
      const payable = Number(liveBillState.total_payable || 0);
      const outstanding = Math.max(payable - Number(transactionalBill.amount_paid || 0), 0);

      if (outstanding <= 0) {
        const latestPayment = await Payment.findOne({ billId })
          .session(session)
          .sort({ createdAt: -1 })
          .populate(populatePayment);
        return { payment: latestPayment, alreadyProcessed: true };
      }

      const appliedAmount = outstanding;
      const updatedPaidAmount = Number(transactionalBill.amount_paid || 0) + appliedAmount;
      const paymentStatus =
        updatedPaidAmount >= payable ? "paid" : updatedPaidAmount > 0 ? "partial" : "pending";
      const normalizedPaymentMethod = String(paymentMethod).toLowerCase();
      const paymentTimestamp = paymentMadeDate ? new Date(paymentMadeDate) : new Date();

      if (Number.isNaN(paymentTimestamp.getTime())) {
        const error = new Error("paymentMadeDate must be a valid date.");
        error.status = 400;
        throw error;
      }

      const billUtrValue = String(transactionalBill.student_utr_number || "").trim();
      if (normalizedPaymentMethod === "upi" && !billUtrValue) {
        const error = new Error("Student UTR is required before recording a UPI payment.");
        error.status = 400;
        throw error;
      }

      const resolvedUtrNumber =
        normalizedPaymentMethod === "upi" ? billUtrValue : billUtrValue || DEFAULT_UTR_MESSAGE;

      const [payment] = await Payment.create(
        [
          {
            studentId: transactionalBill.studentId,
            billId: transactionalBill._id,
            hostelId: transactionalBill.hostelId,
            month: transactionalBill.month,
            amount: appliedAmount,
            paymentMethod: normalizedPaymentMethod,
            utrNumber: resolvedUtrNumber,
            paymentMadeDate: paymentTimestamp,
            status: "paid",
            verifiedBy: req.user._id,
            verifiedAt: new Date(),
            idempotencyKey: idempotencyKey || undefined,
            billPaymentKey,
          },
        ],
        { session }
      );

      transactionalBill.fine = Number(liveBillState.fine || 0);
      transactionalBill.manual_fine = Number(liveBillState.manual_fine || transactionalBill.manual_fine || 0);
      transactionalBill.amount_paid = updatedPaidAmount;
      transactionalBill.payment_status = paymentStatus;
      await transactionalBill.save({ session });

      const ledger = await Ledger.findOne({ hostelId: transactionalBill.hostelId, month: transactionalBill.month }).session(session);
      if (ledger) {
        ledger.totalCollected = Number(ledger.totalCollected || 0) + appliedAmount;
        ledger.outstanding = Math.max(Number(ledger.totalBilled || 0) - ledger.totalCollected, 0);
        ledger.closingBalance =
          Number(ledger.openingBalance || 0) + ledger.totalCollected - Number(ledger.totalExpenses || 0);
        await ledger.save({ session });
      }

      await createAuditLog({
        action: "PAYMENT_RECORDED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: payment._id,
        entityType: "Payment",
        metadata: {
          billId: transactionalBill._id,
          studentId: transactionalBill.studentId,
          hostelId: transactionalBill.hostelId,
          amount: appliedAmount,
          paymentStatus,
          paymentMethod: normalizedPaymentMethod,
          paymentMadeDate: paymentTimestamp,
          studentUtrNumber: resolvedUtrNumber,
        },
        session,
      });

      return {
        payment: await Payment.findById(payment._id).session(session).populate(populatePayment),
        alreadyProcessed: false,
      };
    });

    if (!result.alreadyProcessed) {
      try {
        const updatedBill = await MessBill.findById(billId)
          .populate([
            { path: "studentId", select: "studentId gender isEBL isActive" },
            { path: "userId", select: "name username email" },
            { path: "hostelId", select: "name type location" },
          ]);

        if (updatedBill) {
          await notifyStudentPaymentRecorded({
            bill: updatedBill,
            payment: result.payment,
          });
        }
      } catch (emailError) {
        logger.warn("Payment confirmation email failed", {
          paymentId: String(result.payment._id),
          error: emailError.message,
        });
      }
    }

    return res.status(result.alreadyProcessed ? 200 : 201).json({
      success: true,
      message: result.alreadyProcessed ? "Payment request already processed." : "Payment recorded successfully.",
      data: result.payment,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateKey =
        error?.keyPattern?.billPaymentKey
          ? { billPaymentKey: buildBillPaymentKey(req.body.billId) }
          : error?.keyPattern?.idempotencyKey && req.get("X-Idempotency-Key")
            ? { idempotencyKey: req.get("X-Idempotency-Key") }
            : null;

      if (duplicateKey) {
        const existingPayment = await Payment.findOne(duplicateKey).populate(populatePayment);

        if (existingPayment) {
          return res.status(200).json({
            success: true,
            message: "Payment request already processed.",
            data: existingPayment,
          });
        }
      }
    }

    logger.error("Record payment error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const { month, studentId, billId, hostelId } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (month) {
      if (!MONTH_REGEX.test(month)) {
        return res.status(400).json({
          success: false,
          message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
        });
      }
      filter.month = month;
    }

    if (studentId) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ success: false, message: "Invalid studentId format." });
      }
      filter.studentId = studentId;
    }

    if (billId) {
      if (!mongoose.Types.ObjectId.isValid(billId)) {
        return res.status(400).json({ success: false, message: "Invalid billId format." });
      }
      filter.billId = billId;
    }

    if (req.user.role === "caretaker") {
      filter.hostelId = req.user.hostelId;
    } else if (req.user.role === "student") {
      const student = await Student.findOne({ userId: req.user._id });
      if (!student) {
        return res.status(404).json({ success: false, message: "Student record not found." });
      }
      filter.studentId = student._id;
    } else if (hostelId) {
      if (!mongoose.Types.ObjectId.isValid(hostelId)) {
        return res.status(400).json({ success: false, message: "Invalid hostelId format." });
      }
      filter.hostelId = hostelId;
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate(populatePayment)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);

    const visiblePayments = payments.filter(isOperationalPayment);

    return res.status(200).json({
      success: true,
      message: "Payment history fetched successfully.",
      data: visiblePayments,
      pagination: buildPaginationMeta(page, limit, visiblePayments.length),
    });
  } catch (error) {
    logger.error("Get payment history error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({ success: false, message: "Invalid paymentId format." });
    }

    const payment = await Payment.findById(paymentId).populate(populatePayment);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }

    if (!isOperationalPayment(payment)) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }

    if (req.user.role === "caretaker" && String(payment.hostelId._id || payment.hostelId) !== String(req.user.hostelId)) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    if (req.user.role === "student") {
      const student = await Student.findOne({ userId: req.user._id });
      if (!student || String(payment.studentId._id || payment.studentId) !== String(student._id)) {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Payment fetched successfully.",
      data: payment,
    });
  } catch (error) {
    logger.error("Get payment by id error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getBillPayments = async (req, res) => {
  req.query.billId = req.params.billId;
  return getPaymentHistory(req, res);
};

module.exports = {
  recordPayment,
  getPaymentHistory,
  getPaymentById,
  getBillPayments,
};
