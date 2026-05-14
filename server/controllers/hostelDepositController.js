const mongoose = require("mongoose");

const HostelDeposit = require("../models/HostelDeposit");
const Student = require("../models/Student");
const logger = require("../utils/logger");
const {
  createPdfDocument,
  drawUniversityHeader,
  drawContactDetailsBlock,
  drawSectionHeading,
  drawTable,
  drawSummaryPanel,
  drawSignatureBlock,
  formatCurrency,
  formatDate,
} = require("../utils/pdfLayout");
const { resolveReportContacts } = require("../utils/reportContacts");

const DEPOSIT_POPULATE = [
  { path: "studentId", select: "studentId gender isEBL isActive" },
  { path: "userId", select: "name username email hostelId isActive" },
  { path: "hostelId", select: "name type location" },
  { path: "createdBy", select: "name username role" },
  { path: "reviewedBy", select: "name username role" },
];

const normalizeAcademicYear = (value = "") => String(value || "").trim();
const normalizeNotes = (value = "") => String(value || "").trim();
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const getClampedUsedAmount = (record) =>
  Math.min(roundMoney(record?.amountUsed || 0), roundMoney(record?.amountReceived || 0));
const getAvailableAmount = (record) =>
  Math.max(roundMoney(record?.amountReceived || 0) - getClampedUsedAmount(record), 0);
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

const serializeDeposit = (record) => {
  if (!record) {
    return record;
  }

  const plain = typeof record.toObject === "function" ? record.toObject() : { ...record };
  const amountUsed = getClampedUsedAmount(plain);
  return {
    ...plain,
    amountUsed,
    availableAmount: getAvailableAmount(plain),
  };
};

const loadStudentForRequestUser = async (userId) =>
  Student.findOne({ userId }).populate({
    path: "userId",
    select: "name email hostelId isActive",
    populate: { path: "hostelId", select: "name type location" },
  });

const buildYearlyReportData = async ({ academicYear, reqUser }) => {
  const normalizedAcademicYear = normalizeAcademicYear(academicYear);
  if (!normalizedAcademicYear) {
    const error = new Error("academicYear is required.");
    error.status = 400;
    throw error;
  }

  const academicYearAliases = buildAcademicYearAliases(normalizedAcademicYear);
  const filter = {
    academicYear: academicYearAliases.length > 1 ? { $in: academicYearAliases } : normalizedAcademicYear,
    status: "accepted",
  };

  if (reqUser.role === "caretaker") {
    filter.hostelId = reqUser.hostelId;
  }

  const rows = await HostelDeposit.find(filter).populate(DEPOSIT_POPULATE).sort({ createdAt: -1 });
  const serializedRows = rows.map(serializeDeposit);
  const totalReceived = serializedRows.reduce((sum, row) => sum + Number(row.amountReceived || 0), 0);
  const totalUsed = serializedRows.reduce((sum, row) => sum + Number(row.amountUsed || 0), 0);
  const totalAvailable = serializedRows.reduce((sum, row) => sum + Number(row.availableAmount || 0), 0);

  return {
    rows: serializedRows,
    summary: {
      academicYear: normalizedAcademicYear,
      totalStudents: serializedRows.length,
      totalReceived: roundMoney(totalReceived),
      totalUsed: roundMoney(totalUsed),
      totalAvailable: roundMoney(totalAvailable),
    },
  };
};

const listHostelDeposits = async (req, res) => {
  try {
    const { studentId, academicYear, status } = req.query;
    const filter = {};

    if (req.user.role === "student") {
      const student = await Student.findOne({ userId: req.user._id });
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
      const academicYearAliases = buildAcademicYearAliases(academicYear);
      filter.academicYear = academicYearAliases.length > 1 ? { $in: academicYearAliases } : academicYearAliases[0];
    }

    if (status) {
      if (!["draft", "accepted"].includes(status)) {
        return res.status(400).json({ success: false, message: 'status must be "draft" or "accepted".' });
      }
      filter.status = status;
    }

    const rows = await HostelDeposit.find(filter).populate(DEPOSIT_POPULATE).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: rows.map(serializeDeposit),
    });
  } catch (error) {
    logger.error("List hostel deposits error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const createHostelDeposit = async (req, res) => {
  try {
    const { studentId, academicYear, amountReceived, notes = "" } = req.body;

    let student;
    if (req.user.role === "student") {
      student = await loadStudentForRequestUser(req.user._id);
    } else {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ success: false, message: "Valid studentId is required." });
      }
      student = await Student.findById(studentId).populate({
        path: "userId",
        select: "name email hostelId isActive",
        populate: { path: "hostelId", select: "name type location" },
      });
    }

    if (!student || !student.userId || student.userId.isActive === false || student.isActive === false) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    if (req.user.role === "caretaker" && String(student.userId.hostelId?._id || student.userId.hostelId) !== String(req.user.hostelId)) {
      return res.status(403).json({ success: false, message: "You can only add hostel deposits for your hostel students." });
    }

    const normalizedAcademicYear = normalizeAcademicYear(academicYear);
    if (!normalizedAcademicYear) {
      return res.status(400).json({ success: false, message: "academicYear is required." });
    }

    const numericAmountReceived = roundMoney(amountReceived);
    if (numericAmountReceived < 0) {
      return res.status(400).json({ success: false, message: "amountReceived cannot be negative." });
    }

    const [deposit] = await HostelDeposit.create([
      {
        studentId: student._id,
        userId: student.userId._id,
        hostelId: student.userId.hostelId?._id || student.userId.hostelId,
        academicYear: normalizedAcademicYear,
        amountReceived: numericAmountReceived,
        notes: normalizeNotes(notes),
        createdBy: req.user._id,
      },
    ]);

    const populated = await HostelDeposit.findById(deposit._id).populate(DEPOSIT_POPULATE);
    return res.status(201).json({
      success: true,
      message: "Hostel deposit submitted successfully.",
      data: serializeDeposit(populated),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A hostel deposit already exists for this student and academic year.",
      });
    }

    logger.error("Create hostel deposit error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const updateHostelDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { academicYear, amountReceived, notes } = req.body;

    const deposit = await HostelDeposit.findById(id).populate(DEPOSIT_POPULATE);
    if (!deposit) {
      return res.status(404).json({ success: false, message: "Hostel deposit not found." });
    }

    if (req.user.role === "student") {
      if (String(deposit.userId?._id || deposit.userId) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: "You can only update your own hostel deposit." });
      }
      if (deposit.status !== "draft") {
        return res.status(400).json({ success: false, message: "Accepted hostel deposits can no longer be edited." });
      }
    }

    if (req.user.role === "caretaker" && String(deposit.hostelId?._id || deposit.hostelId) !== String(req.user.hostelId)) {
      return res.status(403).json({ success: false, message: "You can only update hostel deposits for your hostel." });
    }

    if (academicYear !== undefined) {
      const normalizedAcademicYear = normalizeAcademicYear(academicYear);
      if (!normalizedAcademicYear) {
        return res.status(400).json({ success: false, message: "academicYear cannot be empty." });
      }
      deposit.academicYear = normalizedAcademicYear;
    }

    if (amountReceived !== undefined) {
      const numericAmountReceived = roundMoney(amountReceived);
      if (numericAmountReceived < 0) {
        return res.status(400).json({ success: false, message: "amountReceived cannot be negative." });
      }
      if (numericAmountReceived < roundMoney(deposit.amountUsed || 0)) {
        return res.status(400).json({ success: false, message: "amountReceived cannot be less than already used deposit amount." });
      }
      deposit.amountReceived = numericAmountReceived;
    }

    if (notes !== undefined) {
      deposit.notes = normalizeNotes(notes);
    }

    await deposit.save();
    const populated = await HostelDeposit.findById(deposit._id).populate(DEPOSIT_POPULATE);
    return res.status(200).json({
      success: true,
      message: "Hostel deposit updated successfully.",
      data: serializeDeposit(populated),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A hostel deposit already exists for this student and academic year.",
      });
    }

    logger.error("Update hostel deposit error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const verifyHostelDeposit = async (req, res) => {
  try {
    const { id } = req.params;

    const deposit = await HostelDeposit.findById(id).populate(DEPOSIT_POPULATE);
    if (!deposit) {
      return res.status(404).json({ success: false, message: "Hostel deposit not found." });
    }

    if (req.user.role === "caretaker" && String(deposit.hostelId?._id || deposit.hostelId) !== String(req.user.hostelId)) {
      return res.status(403).json({ success: false, message: "You can only verify hostel deposits for your hostel." });
    }

    deposit.status = "accepted";
    deposit.reviewedBy = req.user._id;
    deposit.reviewedAt = new Date();
    await deposit.save();

    const populated = await HostelDeposit.findById(deposit._id).populate(DEPOSIT_POPULATE);
    return res.status(200).json({
      success: true,
      message: "Hostel deposit accepted successfully.",
      data: serializeDeposit(populated),
    });
  } catch (error) {
    logger.error("Verify hostel deposit error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const generateHostelDepositReport = async (req, res) => {
  try {
    const academicYear = normalizeAcademicYear(req.query.academicYear || req.body?.academicYear);
    const report = await buildYearlyReportData({ academicYear, reqUser: req.user });

    return res.status(200).json({
      success: true,
      data: report.rows,
      summary: report.summary,
    });
  } catch (error) {
    logger.error("Generate hostel deposit report error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Server error." });
  }
};

const downloadHostelDepositReportPdf = async (req, res) => {
  try {
    const academicYear = normalizeAcademicYear(req.query.academicYear || req.params.academicYear);
    const report = await buildYearlyReportData({ academicYear, reqUser: req.user });
    const caretakerUserId = report.rows[0]?.createdBy?._id || report.rows[0]?.createdBy || null;
    const hostelId = req.user.role === "caretaker" ? req.user.hostelId : report.rows[0]?.hostelId?._id || report.rows[0]?.hostelId;
    const contacts = hostelId
      ? await resolveReportContacts({
          hostelId,
          caretakerUserId,
        })
      : { warden: null, caretaker: null };

    const doc = createPdfDocument(
      res,
      `hostel-deposit-yearly-report-${report.summary.academicYear}.pdf`
    );

    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "HOSTEL DEPOSIT YEARLY REPORT",
        hostelName: report.rows[0]?.hostelId?.name || "-",
        month: report.summary.academicYear,
        generatedBy: req.user.name || "-",
        generatedAt: new Date(),
        officeLabel: "Accepted Hostel Deposit Register",
      });

    renderHeader();
    drawContactDetailsBlock(doc, contacts);

    drawSummaryPanel(doc, {
      title: "Yearly Deposit Summary",
      items: [
        { label: "Academic Year", value: report.summary.academicYear },
        { label: "Total Students", value: String(report.summary.totalStudents || 0) },
        { label: "Total Received", value: formatCurrency(report.summary.totalReceived || 0) },
        { label: "Total Used", value: formatCurrency(report.summary.totalUsed || 0) },
        { label: "Available", value: formatCurrency(report.summary.totalAvailable || 0) },
      ],
    });

    drawSectionHeading(doc, "Accepted Deposit Records");
    drawTable(doc, {
      columns: [
        { label: "Student", width: 78, key: "studentCode" },
        { label: "Name", width: 110, key: "name" },
        { label: "Academic Year", width: 82, key: "academicYear" },
        { label: "Received", width: 65, key: "received", align: "right" },
        { label: "Used", width: 58, key: "used", align: "right" },
        { label: "Available", width: 62, key: "available", align: "right" },
        { label: "Accepted On", width: 44, key: "acceptedOn", align: "right" },
      ],
      rows: report.rows.map((row) => ({
        studentCode: row.studentId?.studentId || "-",
        name: row.userId?.name || "-",
        academicYear: row.academicYear || "-",
        received: formatCurrency(row.amountReceived || 0),
        used: formatCurrency(row.amountUsed || 0),
        available: formatCurrency(row.availableAmount || 0),
        acceptedOn: formatDate(row.reviewedAt),
      })),
      fontSize: 9,
    });

    drawSignatureBlock(doc, {
      signatures: [
        { label: "Caretaker" },
        { label: "Warden" },
        { label: "Dean and Chairman, Hostel Supervisory Committee" },
      ],
      footerDate: new Date(),
    });

    doc.end();
  } catch (error) {
    logger.error("Download hostel deposit yearly report PDF error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({ success: false, message: error.message || "Error generating hostel deposit PDF." });
  }
};

module.exports = {
  listHostelDeposits,
  createHostelDeposit,
  updateHostelDeposit,
  verifyHostelDeposit,
  generateHostelDepositReport,
  downloadHostelDepositReportPdf,
  serializeDeposit,
  getAvailableAmount,
};
