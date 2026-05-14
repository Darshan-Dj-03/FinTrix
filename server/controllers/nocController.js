const mongoose = require("mongoose");

const NocSettlement = require("../models/NocSettlement");
const Student = require("../models/Student");
const HostelDeposit = require("../models/HostelDeposit");
const { getAvailableAmount, serializeDeposit } = require("./hostelDepositController");
const { runInTransaction } = require("../utils/transaction");
const logger = require("../utils/logger");

const NOC_POPULATE = [
  { path: "studentId", select: "studentId gender isEBL isActive" },
  { path: "userId", select: "name username email hostelId isActive" },
  { path: "hostelId", select: "name type location" },
  { path: "hostelDepositId", select: "academicYear amountReceived amountUsed status notes reviewedAt" },
  { path: "verifiedBy", select: "name username role" },
  { path: "createdBy", select: "name username role" },
];

const normalizeAcademicYear = (value = "") => String(value || "").trim();
const normalizeNotes = (value = "") => String(value || "").trim();
const normalizeMode = (value = "") => String(value || "").trim().toLowerCase();
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const buildAcademicYearAliases = (value = "") => {
  const normalized = normalizeAcademicYear(value);
  if (!normalized) {
    return [];
  }

  const aliases = new Set([normalized]);
  const rangeMatch = normalized.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (rangeMatch) {
    aliases.add(rangeMatch[1]);
  } else if (/^\d{4}$/.test(normalized)) {
    aliases.add(`${normalized}-${Number(normalized) + 1}`);
  }

  return [...aliases];
};
const computeTotalBalanceAmount = ({
  baseAmount = 0,
  damagesAmount = 0,
  othersAmount = 0,
}) => roundMoney(baseAmount) + roundMoney(damagesAmount) + roundMoney(othersAmount);

const canAccessHostelScopedRecord = (record, reqUser) =>
  reqUser.role !== "caretaker" || String(record.hostelId?._id || record.hostelId) === String(reqUser.hostelId);

const getStudentForCurrentUser = async (userId) => Student.findOne({ userId });
const findAcceptedDeposit = async (studentId, academicYear, session = null) => {
  const academicYearAliases = buildAcademicYearAliases(academicYear);
  const query = HostelDeposit.findOne({
    studentId,
    academicYear: academicYearAliases.length > 1 ? { $in: academicYearAliases } : academicYear,
    status: "accepted",
  }).populate(DEPOSIT_POPULATE);

  if (session) {
    query.session(session);
  }

  return query;
};
const DEPOSIT_POPULATE = [
  { path: "studentId", select: "studentId gender isEBL isActive" },
  { path: "userId", select: "name username email hostelId isActive" },
  { path: "hostelId", select: "name type location" },
  { path: "reviewedBy", select: "name username role" },
];
const resolveDepositUsage = (noc, depositRecord, useHostelDeposit) => {
  if (!useHostelDeposit || !depositRecord) {
    return {
      useHostelDeposit: false,
      hostelDepositId: null,
      hostelDepositAppliedAmount: 0,
      remainingAmount: roundMoney(noc.balanceAmount || 0),
      matchedHostelDeposit: depositRecord ? serializeDeposit(depositRecord) : null,
      availableHostelDepositAmount: 0,
    };
  }

  const availableHostelDepositAmount = roundMoney(getAvailableAmount(depositRecord));
  const appliedAmount = Math.min(roundMoney(noc.balanceAmount || 0), availableHostelDepositAmount);
  const remainingAmount = Math.max(roundMoney(noc.balanceAmount || 0) - appliedAmount, 0);

  return {
    useHostelDeposit: true,
    hostelDepositId: depositRecord._id,
    hostelDepositAppliedAmount: appliedAmount,
    remainingAmount,
    matchedHostelDeposit: serializeDeposit(depositRecord),
    availableHostelDepositAmount,
  };
};
const attachDepositPreview = async (noc) => {
  const matchingDeposit = await findAcceptedDeposit(noc.studentId?._id || noc.studentId, noc.academicYear);
  const usage = resolveDepositUsage(noc, matchingDeposit, Boolean(noc.useHostelDeposit));
  const plain = typeof noc.toObject === "function" ? noc.toObject() : { ...noc };

  return {
    ...plain,
    ...(plain.status !== "paid"
      ? {
          useHostelDeposit: usage.useHostelDeposit,
          hostelDepositId: usage.hostelDepositId,
          hostelDepositAppliedAmount: usage.hostelDepositAppliedAmount,
          remainingAmount: usage.remainingAmount,
        }
      : {}),
    matchedHostelDeposit: usage.matchedHostelDeposit,
    availableHostelDepositAmount: usage.availableHostelDepositAmount,
  };
};

const listNocSettlements = async (req, res) => {
  try {
    const { studentId, academicYear, status } = req.query;
    const filter = {};

    if (req.user.role === "student") {
      const student = await getStudentForCurrentUser(req.user._id);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student record not found." });
      }

      filter.studentId = student._id;
    } else if (req.user.role === "caretaker") {
      filter.hostelId = req.user.hostelId;
      if (studentId) {
        if (!mongoose.Types.ObjectId.isValid(studentId)) {
          return res.status(400).json({ success: false, message: "Invalid studentId format." });
        }
        filter.studentId = studentId;
      }
    } else if (studentId) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ success: false, message: "Invalid studentId format." });
      }
      filter.studentId = studentId;
    }

    if (academicYear) {
      filter.academicYear = normalizeAcademicYear(academicYear);
    }

    if (status) {
      if (!["pending", "paid"].includes(status)) {
        return res.status(400).json({ success: false, message: 'status must be "pending" or "paid".' });
      }
      filter.status = status;
    }

    const rows = await NocSettlement.find(filter).populate(NOC_POPULATE).sort({ createdAt: -1 });
    const rowsWithDepositPreview = await Promise.all(rows.map(attachDepositPreview));

    return res.status(200).json({
      success: true,
      data: rowsWithDepositPreview,
    });
  } catch (error) {
    logger.error("List NOC settlements error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const createNocSettlement = async (req, res) => {
  try {
    const {
      studentId,
      academicYear,
      leavingDate,
      balanceAmount,
      baseAmount,
      damagesAmount = 0,
      othersAmount = 0,
      useHostelDeposit = false,
      notes = "",
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: "Valid studentId is required." });
    }

    const normalizedAcademicYear = normalizeAcademicYear(academicYear);
    if (!normalizedAcademicYear) {
      return res.status(400).json({ success: false, message: "academicYear is required." });
    }

    const numericBaseAmount = roundMoney(baseAmount !== undefined ? baseAmount : balanceAmount);
    const numericDamagesAmount = roundMoney(damagesAmount);
    const numericOthersAmount = roundMoney(othersAmount);
    if (numericBaseAmount < 0 || numericDamagesAmount < 0 || numericOthersAmount < 0) {
      return res.status(400).json({ success: false, message: "NOC amounts cannot be negative." });
    }
    const numericBalanceAmount = computeTotalBalanceAmount({
      baseAmount: numericBaseAmount,
      damagesAmount: numericDamagesAmount,
      othersAmount: numericOthersAmount,
    });

    const student = await Student.findById(studentId).populate({
      path: "userId",
      select: "name email hostelId isActive role",
      populate: { path: "hostelId", select: "name type location" },
    });

    if (!student || !student.userId || student.userId.isActive === false || student.isActive === false) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    if (req.user.role === "caretaker" && String(student.userId.hostelId?._id || student.userId.hostelId) !== String(req.user.hostelId)) {
      return res.status(403).json({ success: false, message: "You can only create NOC records for your hostel students." });
    }

    const parsedLeavingDate = leavingDate ? new Date(leavingDate) : null;
    if (parsedLeavingDate && Number.isNaN(parsedLeavingDate.getTime())) {
      return res.status(400).json({ success: false, message: "leavingDate must be a valid date." });
    }

    const matchingDeposit = await findAcceptedDeposit(student._id, normalizedAcademicYear);
    if (useHostelDeposit && !matchingDeposit) {
      return res.status(400).json({
        success: false,
        message: "No accepted hostel deposit is available for this academic year.",
      });
    }

    const depositUsage = resolveDepositUsage(
      { balanceAmount: numericBalanceAmount, hostelDepositId: null, hostelDepositAppliedAmount: 0 },
      matchingDeposit,
      Boolean(useHostelDeposit)
    );

    const [noc] = await NocSettlement.create([
      {
        studentId: student._id,
        userId: student.userId._id,
        hostelId: student.userId.hostelId?._id || student.userId.hostelId,
        academicYear: normalizedAcademicYear,
        leavingDate: parsedLeavingDate,
        baseAmount: numericBaseAmount,
        damagesAmount: numericDamagesAmount,
        othersAmount: numericOthersAmount,
        balanceAmount: numericBalanceAmount,
        useHostelDeposit: depositUsage.useHostelDeposit,
        hostelDepositId: depositUsage.hostelDepositId,
        hostelDepositAppliedAmount: depositUsage.hostelDepositAppliedAmount,
        remainingAmount: depositUsage.remainingAmount,
        notes: normalizeNotes(notes),
        createdBy: req.user._id,
      },
    ]);

    const populated = await NocSettlement.findById(noc._id).populate(NOC_POPULATE);

    return res.status(201).json({
      success: true,
      message: "NOC settlement created successfully.",
      data: await attachDepositPreview(populated),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An NOC settlement already exists for this student and academic year.",
      });
    }

    logger.error("Create NOC settlement error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const updateNocSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    const { academicYear, leavingDate, balanceAmount, baseAmount, damagesAmount, othersAmount, notes } = req.body;

    const noc = await NocSettlement.findById(id).populate(NOC_POPULATE);
    if (!noc) {
      return res.status(404).json({ success: false, message: "NOC settlement not found." });
    }

    if (!canAccessHostelScopedRecord(noc, req.user)) {
      return res.status(403).json({ success: false, message: "You can only update NOC settlements for your hostel." });
    }

    if (academicYear !== undefined) {
      const normalizedAcademicYear = normalizeAcademicYear(academicYear);
      if (!normalizedAcademicYear) {
        return res.status(400).json({ success: false, message: "academicYear cannot be empty." });
      }
      noc.academicYear = normalizedAcademicYear;
    }

    if (leavingDate !== undefined) {
      const parsedLeavingDate = leavingDate ? new Date(leavingDate) : null;
      if (parsedLeavingDate && Number.isNaN(parsedLeavingDate.getTime())) {
        return res.status(400).json({ success: false, message: "leavingDate must be a valid date." });
      }
      noc.leavingDate = parsedLeavingDate;
    }

    if (baseAmount !== undefined || damagesAmount !== undefined || othersAmount !== undefined || balanceAmount !== undefined) {
      const numericBaseAmount = roundMoney(baseAmount !== undefined ? baseAmount : balanceAmount !== undefined ? balanceAmount : noc.baseAmount);
      const numericDamagesAmount = roundMoney(damagesAmount !== undefined ? damagesAmount : noc.damagesAmount);
      const numericOthersAmount = roundMoney(othersAmount !== undefined ? othersAmount : noc.othersAmount);
      if (numericBaseAmount < 0 || numericDamagesAmount < 0 || numericOthersAmount < 0) {
        return res.status(400).json({ success: false, message: "NOC amounts cannot be negative." });
      }

      noc.baseAmount = numericBaseAmount;
      noc.damagesAmount = numericDamagesAmount;
      noc.othersAmount = numericOthersAmount;
      noc.balanceAmount = computeTotalBalanceAmount({
        baseAmount: numericBaseAmount,
        damagesAmount: numericDamagesAmount,
        othersAmount: numericOthersAmount,
      });
    }

    if (notes !== undefined) {
      noc.notes = normalizeNotes(notes);
    }

    if (noc.status !== "paid") {
      const matchingDeposit = await findAcceptedDeposit(noc.studentId?._id || noc.studentId, noc.academicYear);
      const usage = resolveDepositUsage(noc, matchingDeposit, Boolean(noc.useHostelDeposit));
      noc.useHostelDeposit = usage.useHostelDeposit;
      noc.hostelDepositId = usage.hostelDepositId;
      noc.hostelDepositAppliedAmount = usage.hostelDepositAppliedAmount;
      noc.remainingAmount = usage.remainingAmount;
      noc.amount_paid = 0;
    }

    await noc.save();
    const populated = await NocSettlement.findById(noc._id).populate(NOC_POPULATE);

    return res.status(200).json({
      success: true,
      message: "NOC settlement updated successfully.",
      data: await attachDepositPreview(populated),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An NOC settlement already exists for this student and academic year.",
      });
    }

    logger.error("Update NOC settlement error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const updateStudentNocPaymentInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMode, paymentMadeDate, utrNumber, useHostelDeposit } = req.body;

    const noc = await NocSettlement.findById(id).populate(NOC_POPULATE);
    if (!noc) {
      return res.status(404).json({ success: false, message: "NOC settlement not found." });
    }

    if (req.user.role === "student" && String(noc.userId?._id || noc.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You can only update your own NOC payment details." });
    }

    if (!canAccessHostelScopedRecord(noc, req.user)) {
      return res.status(403).json({ success: false, message: "You can only update NOC payment details for your hostel." });
    }

    const normalizedUtrNumber = String(utrNumber || "").trim();
    const normalizedPaymentModeInput = paymentMode === undefined || paymentMode === null ? "" : normalizeMode(paymentMode);
    const resolvedPaymentMode = normalizedPaymentModeInput || (normalizedUtrNumber ? "upi" : noc.student_payment_mode || "");

    if (!["cash", "upi", ""].includes(resolvedPaymentMode)) {
      return res.status(400).json({ success: false, message: "paymentMode must be cash or upi." });
    }

    const resolvedPaymentDate =
      paymentMadeDate === undefined ? noc.student_payment_made_date || null : paymentMadeDate ? new Date(paymentMadeDate) : null;
    if (resolvedPaymentDate instanceof Date && Number.isNaN(resolvedPaymentDate.getTime())) {
      return res.status(400).json({ success: false, message: "paymentMadeDate must be a valid date." });
    }

    noc.student_payment_mode = resolvedPaymentMode;
    noc.student_payment_made_date = resolvedPaymentDate;
    noc.student_utr_number = resolvedPaymentMode === "upi" ? normalizedUtrNumber : "";

    const shouldUseHostelDeposit =
      useHostelDeposit === undefined ? Boolean(noc.useHostelDeposit) : Boolean(useHostelDeposit);
    const matchingDeposit = await findAcceptedDeposit(noc.studentId?._id || noc.studentId, noc.academicYear);
    if (shouldUseHostelDeposit && !matchingDeposit) {
      return res.status(400).json({
        success: false,
        message: "No accepted hostel deposit is available for this academic year.",
      });
    }

    const usage = resolveDepositUsage(noc, matchingDeposit, shouldUseHostelDeposit);
    noc.useHostelDeposit = usage.useHostelDeposit;
    noc.hostelDepositId = usage.hostelDepositId;
    noc.hostelDepositAppliedAmount = usage.hostelDepositAppliedAmount;
    noc.remainingAmount = usage.remainingAmount;
    await noc.save();

    const populated = await NocSettlement.findById(noc._id).populate(NOC_POPULATE);
    return res.status(200).json({
      success: true,
      message: "NOC payment details updated successfully.",
      data: await attachDepositPreview(populated),
    });
  } catch (error) {
    logger.error("Update NOC payment details error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const recordNocPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod = "upi", paymentMadeDate } = req.body;

    const normalizedPaymentMethod = normalizeMode(paymentMethod);
    if (!["cash", "upi"].includes(normalizedPaymentMethod)) {
      return res.status(400).json({ success: false, message: "paymentMethod must be either cash or upi." });
    }

    const paymentTimestamp = paymentMadeDate ? new Date(paymentMadeDate) : new Date();
    if (Number.isNaN(paymentTimestamp.getTime())) {
      return res.status(400).json({ success: false, message: "paymentMadeDate must be a valid date." });
    }

    const result = await runInTransaction(async (session) => {
      const noc = await NocSettlement.findById(id).session(session).populate(NOC_POPULATE);
      if (!noc) {
        const error = new Error("NOC settlement not found.");
        error.status = 404;
        throw error;
      }

      if (!canAccessHostelScopedRecord(noc, req.user)) {
        const error = new Error("You can only record NOC payments for your hostel.");
        error.status = 403;
        throw error;
      }

      if (noc.status === "paid") {
        return await NocSettlement.findById(noc._id).session(session).populate(NOC_POPULATE);
      }

      const studentUtr = String(noc.student_utr_number || "").trim();
      if (normalizedPaymentMethod === "upi" && roundMoney(noc.remainingAmount || 0) > 0 && !studentUtr) {
        const error = new Error("Student UTR is required before recording a UPI NOC payment.");
        error.status = 400;
        throw error;
      }

      let matchingDeposit = null;
      if (noc.useHostelDeposit) {
        matchingDeposit = await HostelDeposit.findById(noc.hostelDepositId).session(session);
        if (!matchingDeposit || matchingDeposit.status !== "accepted") {
          const error = new Error("Accepted hostel deposit not found for this NOC deduction.");
          error.status = 400;
          throw error;
        }

        const refreshedUsage = resolveDepositUsage(noc, matchingDeposit, true);
        noc.hostelDepositAppliedAmount = refreshedUsage.hostelDepositAppliedAmount;
        noc.remainingAmount = refreshedUsage.remainingAmount;
        noc.hostelDepositId = refreshedUsage.hostelDepositId;

        const currentAmountReceived = roundMoney(matchingDeposit.amountReceived || 0);
        const currentAmountUsed = roundMoney(matchingDeposit.amountUsed || 0);
        const nocDepositUsage = roundMoney(noc.hostelDepositAppliedAmount || 0);
        if (currentAmountUsed + nocDepositUsage > currentAmountReceived) {
          const error = new Error("Hostel deposit usage cannot exceed the accepted deposit amount.");
          error.status = 400;
          throw error;
        }

        matchingDeposit.amountUsed = currentAmountUsed + nocDepositUsage;
        await matchingDeposit.save({ session });
      }

      noc.amount_paid = roundMoney(noc.remainingAmount || 0);
      noc.status = "paid";
      noc.verifiedBy = req.user._id;
      noc.verifiedAt = new Date();
      noc.student_payment_mode = roundMoney(noc.remainingAmount || 0) > 0 ? normalizedPaymentMethod : noc.student_payment_mode || normalizedPaymentMethod;
      noc.student_payment_made_date = paymentTimestamp;
      await noc.save({ session });

      return await NocSettlement.findById(noc._id).session(session).populate(NOC_POPULATE);
    });

    return res.status(200).json({
      success: true,
      message: "NOC payment recorded successfully.",
      data: await attachDepositPreview(result),
    });
  } catch (error) {
    logger.error("Record NOC payment error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

module.exports = {
  listNocSettlements,
  createNocSettlement,
  updateNocSettlement,
  updateStudentNocPaymentInfo,
  recordNocPayment,
};
