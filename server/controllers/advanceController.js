const mongoose = require("mongoose");

const Advance = require("../models/Advance");
const Hostel = require("../models/Hostel");
const Student = require("../models/Student");
const logger = require("../utils/logger");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const POPULATE_CONFIG = [
  { path: "hostelId", select: "name type location" },
  {
    path: "prefectStudentId",
    select: "studentId gender isActive userId",
    populate: { path: "userId", select: "name email hostelId isActive" },
  },
  { path: "createdBy", select: "name email role" },
  { path: "settlements.recordedBy", select: "name email role" },
];

const isOperationalStudent = (student) =>
  Boolean(
    student &&
      student.isActive !== false &&
      student.userId &&
      student.userId.isActive !== false
  );

const resolveHostelIdForWrite = async (req, providedHostelId) => {
  if (req.user.role === "caretaker") {
    if (!req.user.hostelId) {
      return { error: "Caretaker is not assigned to any hostel." };
    }

    return { hostelId: req.user.hostelId.toString() };
  }

  if (!providedHostelId) {
    return { error: "hostelId is required." };
  }

  if (!mongoose.Types.ObjectId.isValid(providedHostelId)) {
    return { error: "Invalid hostelId format." };
  }

  return { hostelId: providedHostelId };
};

const normalizeBillDates = (billDates = []) => {
  if (!Array.isArray(billDates)) {
    return { error: "billDates must be an array." };
  }

  const normalized = [];
  for (const row of billDates) {
    const rawDate = row?.billDate || row;
    const parsedDate = new Date(rawDate);

    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "Each bill date must be a valid date." };
    }

    normalized.push({ billDate: parsedDate });
  }

  return { billDates: normalized };
};

const normalizeSettlements = (settlements = [], recordedBy = null) => {
  if (!Array.isArray(settlements)) {
    return { error: "settlements must be an array." };
  }

  const normalized = [];
  for (const row of settlements) {
    const numericAmount = Number(row?.amount);
    if (Number.isNaN(numericAmount) || numericAmount < 0) {
      return { error: "Each settlement amount must be a non-negative number." };
    }

    const parsedDate = new Date(row?.settlementDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "Each settlement date must be a valid date." };
    }

    normalized.push({
      settlementDate: parsedDate,
      amount: numericAmount,
      notes: String(row?.notes || "").trim(),
      recordedBy: row?.recordedBy || recordedBy || null,
      isLegacyImported: Boolean(row?.isLegacyImported),
    });
  }

  return { settlements: normalized };
};

const sumSettlements = (settlements = []) =>
  settlements.reduce((sum, row) => sum + Number(row.amount || 0), 0);

const getLegacyClosedAmount = (advance) => {
  const currentClosedAmount = Number(advance?.closedAmount || 0);
  const currentSettlementTotal = sumSettlements(advance?.settlements || []);
  return Math.max(currentClosedAmount - currentSettlementTotal, 0);
};

const ensurePrefectStudent = async (prefectStudentId, hostelId) => {
  if (!prefectStudentId || !mongoose.Types.ObjectId.isValid(prefectStudentId)) {
    return { error: "Valid prefectStudentId is required.", status: 400 };
  }

  const student = await Student.findById(prefectStudentId).populate({
    path: "userId",
    select: "hostelId role isActive",
  });

  if (!student || !student.userId) {
    return { error: "Prefect student not found.", status: 404 };
  }

  if (
    student.userId.role !== "student" ||
    student.userId.isActive === false ||
    student.isActive === false ||
    String(student.userId.hostelId) !== String(hostelId)
  ) {
    return { error: "Selected prefect must be an active student from this hostel.", status: 400 };
  }

  return { student };
};

const addAdvance = async (req, res) => {
  try {
    const {
      month,
      prefectStudentId,
      takenAmount,
      closedAmount = 0,
      settlements = [],
      billDates = [],
      chequeDetails = "",
      hostelId: providedHostelId,
    } = req.body;

    if (!month || !prefectStudentId || takenAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: "month, prefectStudentId, and takenAmount are required.",
      });
    }

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const numericTakenAmount = Number(takenAmount);
    const numericClosedAmount = Number(closedAmount);
    if (
      Number.isNaN(numericTakenAmount) ||
      numericTakenAmount < 0 ||
      Number.isNaN(numericClosedAmount) ||
      numericClosedAmount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "takenAmount and closedAmount must be non-negative numbers.",
      });
    }

    const resolved = await resolveHostelIdForWrite(req, providedHostelId);
    if (resolved.error) {
      return res.status(400).json({ success: false, message: resolved.error });
    }

    const [hostel, prefectCheck, billDateValidation] = await Promise.all([
      Hostel.findById(resolved.hostelId),
      ensurePrefectStudent(prefectStudentId, resolved.hostelId),
      Promise.resolve(normalizeBillDates(billDates)),
    ]);
    const settlementValidation = normalizeSettlements(settlements, req.user._id);

    if (!hostel) {
      return res.status(404).json({ success: false, message: "Hostel not found." });
    }

    if (prefectCheck.error) {
      return res.status(prefectCheck.status).json({ success: false, message: prefectCheck.error });
    }

    if (billDateValidation.error) {
      return res.status(400).json({ success: false, message: billDateValidation.error });
    }

    if (settlementValidation.error) {
      return res.status(400).json({ success: false, message: settlementValidation.error });
    }

    const resolvedClosedAmount = settlementValidation.settlements.length
      ? sumSettlements(settlementValidation.settlements)
      : numericClosedAmount;

    if (resolvedClosedAmount > numericTakenAmount) {
      return res.status(400).json({
        success: false,
        message: "Settled amount cannot exceed the taken amount.",
      });
    }

    const advance = await Advance.create({
      hostelId: resolved.hostelId,
      prefectStudentId,
      month,
      takenAmount: numericTakenAmount,
      closedAmount: resolvedClosedAmount,
      settlements: settlementValidation.settlements,
      billDates: billDateValidation.billDates,
      chequeDetails: String(chequeDetails || "").trim(),
      createdBy: req.user._id,
    });

    const populated = await advance.populate(POPULATE_CONFIG);

    return res.status(201).json({
      success: true,
      message: "Advance saved successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Add advance error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const listAdvancesByMonth = async (req, res) => {
  try {
    const { month } = req.params;

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const filter = { month };

    if (req.user.role === "caretaker") {
      if (!req.user.hostelId) {
        return res.status(400).json({ success: false, message: "Caretaker is not assigned to any hostel." });
      }
      filter.hostelId = req.user.hostelId;
    } else if (req.query.hostelId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.hostelId)) {
        return res.status(400).json({ success: false, message: "Invalid hostelId format." });
      }
      filter.hostelId = req.query.hostelId;
    }

    const rows = await Advance.find(filter).populate(POPULATE_CONFIG).sort({ createdAt: -1 });
    const visibleRows = rows.filter((row) => isOperationalStudent(row.prefectStudentId));

    return res.status(200).json({
      success: true,
      message: "Advances fetched successfully.",
      data: visibleRows,
    });
  } catch (error) {
    logger.error("List advances error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const updateAdvance = async (req, res) => {
  try {
    const { advanceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(advanceId)) {
      return res.status(400).json({ success: false, message: "Invalid advanceId format." });
    }

    const advance = await Advance.findById(advanceId);
    if (!advance) {
      return res.status(404).json({ success: false, message: "Advance not found." });
    }

    if (req.user.role === "caretaker" && String(advance.hostelId) !== String(req.user.hostelId)) {
      return res.status(403).json({ success: false, message: "You can only update advances from your hostel." });
    }

    if (req.body.prefectStudentId !== undefined) {
      const prefectCheck = await ensurePrefectStudent(req.body.prefectStudentId, advance.hostelId);
      if (prefectCheck.error) {
        return res.status(prefectCheck.status).json({ success: false, message: prefectCheck.error });
      }
      advance.prefectStudentId = req.body.prefectStudentId;
    }

    if (req.body.takenAmount !== undefined) {
      const numericTakenAmount = Number(req.body.takenAmount);
      if (Number.isNaN(numericTakenAmount) || numericTakenAmount < 0) {
        return res.status(400).json({ success: false, message: "takenAmount must be a non-negative number." });
      }
      advance.takenAmount = numericTakenAmount;
    }

    if (req.body.closedAmount !== undefined) {
      const numericClosedAmount = Number(req.body.closedAmount);
      if (Number.isNaN(numericClosedAmount) || numericClosedAmount < 0) {
        return res.status(400).json({ success: false, message: "closedAmount must be a non-negative number." });
      }
      advance.closedAmount = numericClosedAmount;
    }

    if (req.body.settlements !== undefined) {
      const settlementValidation = normalizeSettlements(req.body.settlements, req.user._id);
      if (settlementValidation.error) {
        return res.status(400).json({ success: false, message: settlementValidation.error });
      }
      const hasLegacyImportedSettlement = Array.isArray(req.body.settlements)
        ? req.body.settlements.some((row) => Boolean(row?.isLegacyImported))
        : false;
      const legacyClosedAmount = hasLegacyImportedSettlement ? 0 : getLegacyClosedAmount(advance);
      advance.settlements = settlementValidation.settlements;
      advance.closedAmount = legacyClosedAmount + sumSettlements(settlementValidation.settlements);
    }

    if (Number(advance.closedAmount || 0) > Number(advance.takenAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: "Settled amount cannot exceed the taken amount.",
      });
    }

    if (req.body.chequeDetails !== undefined) {
      advance.chequeDetails = String(req.body.chequeDetails || "").trim();
    }

    if (req.body.billDates !== undefined) {
      const billDateValidation = normalizeBillDates(req.body.billDates);
      if (billDateValidation.error) {
        return res.status(400).json({ success: false, message: billDateValidation.error });
      }
      advance.billDates = billDateValidation.billDates;
    }

    await advance.save();
    const populated = await advance.populate(POPULATE_CONFIG);

    return res.status(200).json({
      success: true,
      message: "Advance updated successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Update advance error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const deleteAdvance = async (req, res) => {
  try {
    const { advanceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(advanceId)) {
      return res.status(400).json({ success: false, message: "Invalid advanceId format." });
    }

    const advance = await Advance.findById(advanceId);
    if (!advance) {
      return res.status(404).json({ success: false, message: "Advance not found." });
    }

    if (req.user.role === "caretaker" && String(advance.hostelId) !== String(req.user.hostelId)) {
      return res.status(403).json({ success: false, message: "You can only delete advances from your hostel." });
    }

    await Advance.findByIdAndDelete(advanceId);

    return res.status(200).json({
      success: true,
      message: "Advance deleted successfully.",
      data: {},
    });
  } catch (error) {
    logger.error("Delete advance error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  addAdvance,
  listAdvancesByMonth,
  updateAdvance,
  deleteAdvance,
};
