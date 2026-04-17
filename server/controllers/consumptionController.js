const mongoose = require("mongoose");

require("../models/User");
require("../models/Hostel");
const StudentConsumption = require("../models/StudentConsumption");
const Student = require("../models/Student");
const MessBill = require("../models/MessBill");
const { syncBillDependentArtifacts } = require("./hostelExpenseController");
const logger = require("../utils/logger");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const CONSUMPTION_POPULATE = {
  path: "studentId",
  select: "studentId gender isEBL isActive userId",
  populate: {
    path: "userId",
    select: "name email hostelId isActive",
    populate: {
      path: "hostelId",
      select: "name type location",
    },
  },
};

const isOperationalStudent = (student) =>
  Boolean(
    student &&
      student.isActive !== false &&
      student.userId &&
      student.userId.isActive !== false
  );

const isOperationalConsumptionRecord = (record) => isOperationalStudent(record?.studentId);

const toCount = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
};

const resolveCounts = (body = {}) => {
  const egg_count = body.egg_count !== undefined ? toCount(body.egg_count) : toCount(body.eggCount);
  const chicken_count = body.chicken_count !== undefined ? toCount(body.chicken_count) : toCount(body.chickenCount);
  const paneer_count = body.paneer_count !== undefined ? toCount(body.paneer_count) : toCount(body.paneerCount);
  const milk_amount = body.milk_amount !== undefined ? toCount(body.milk_amount) : toCount(body.milkAmount);
  const fine_amount = body.fine_amount !== undefined ? toCount(body.fine_amount) : toCount(body.fineAmount);
  const absent_days = body.absent_days !== undefined ? toCount(body.absent_days) : toCount(body.absentDays);

  return { egg_count, chicken_count, paneer_count, milk_amount, fine_amount, absent_days };
};

const findAuthorizedStudent = async (studentId, req) => {
  const student = await Student.findById(studentId).populate({
    path: "userId",
    select: "_id hostelId",
  });

  if (!student) {
    return { error: { status: 404, message: "Student not found." } };
  }

  if (!isOperationalStudent(student)) {
    return { error: { status: 400, message: "Inactive students cannot be included in consumption." } };
  }

  if (req.user.role === "caretaker") {
    if (!req.user.hostelId || student.userId?.hostelId?.toString() !== req.user.hostelId.toString()) {
      return { error: { status: 403, message: "Student not in your hostel." } };
    }
  }

  if (req.user.role === "student" && student.userId?._id?.toString() !== req.user._id.toString()) {
    return { error: { status: 403, message: "You can only view your own consumption." } };
  }

  return { student };
};

const ensureConsumptionMonthUnlocked = async ({ month, hostelIds = [] }) => {
  const uniqueHostelIds = [...new Set(hostelIds.filter(Boolean).map((value) => value.toString()))];

  if (!month || uniqueHostelIds.length === 0) {
    return;
  }

  const existingBill = await MessBill.findOne({
    month,
    hostelId: { $in: uniqueHostelIds },
  }).select("_id hostelId month");

  if (existingBill) {
    const error = new Error(
      "Consumption cannot be updated after bills have been generated for this month."
    );
    error.status = 409;
    throw error;
  }
};

const syncConsumptionArtifacts = async ({ req, month, records = [] }) => {
  const hostelId =
    req.user.role === "caretaker"
      ? req.user.hostelId
      : records[0]?.studentId?.userId?.hostelId?._id || records[0]?.studentId?.userId?.hostelId || null;

  if (!hostelId || !month) {
    return;
  }

  await syncBillDependentArtifacts({
    hostelId,
    month,
    userId: req.user._id,
  });
};

const queueConsumptionArtifactSync = ({ req, month, records = [] }) => {
  setImmediate(() => {
    syncConsumptionArtifacts({ req, month, records }).catch((error) => {
      logger.warn("Consumption artifact sync failed", {
        month,
        hostelId: req.user?.hostelId || null,
        error: error.message,
      });
    });
  });
};

const addConsumption = async (req, res) => {
  try {
    const { studentId, month } = req.body;
    const counts = resolveCounts(req.body);

    if (!studentId || !month) {
      return res.status(400).json({ success: false, message: "studentId and month are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: "Invalid studentId format." });
    }

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    if (
      [counts.egg_count, counts.chicken_count, counts.paneer_count, counts.milk_amount, counts.fine_amount, counts.absent_days].some(
        (value) => Number.isNaN(value) || value < 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "egg_count, chicken_count, paneer_count, milk_amount, fine_amount, and absent_days must be non-negative numbers.",
      });
    }

    const { error, student } = await findAuthorizedStudent(studentId, req);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    await ensureConsumptionMonthUnlocked({
      month,
      hostelIds: [student.userId?.hostelId],
    });

    const existing = await StudentConsumption.findOne({ studentId, month });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Consumption record already exists for this student and month.",
      });
    }

    const consumption = await StudentConsumption.create({
      studentId,
      month,
      ...counts,
    });

    const populated = await consumption.populate(CONSUMPTION_POPULATE);
    queueConsumptionArtifactSync({ req, month, records: [populated] });

    return res.status(201).json({
      success: true,
      message: "Consumption record added successfully.",
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Consumption record already exists for this student and month.",
      });
    }

    logger.error("Add consumption error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const updateConsumption = async (req, res) => {
  try {
    const { id } = req.params;
    const counts = resolveCounts(req.body);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid consumption ID." });
    }

    if (
      [counts.egg_count, counts.chicken_count, counts.paneer_count, counts.milk_amount, counts.fine_amount, counts.absent_days].some(
        (value) => Number.isNaN(value) || value < 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "egg_count, chicken_count, paneer_count, milk_amount, fine_amount, and absent_days must be non-negative numbers.",
      });
    }

    const consumption = await StudentConsumption.findById(id).populate(CONSUMPTION_POPULATE);
    if (!consumption) {
      return res.status(404).json({ success: false, message: "Consumption record not found." });
    }

    const { error, student } = await findAuthorizedStudent(consumption.studentId._id, req);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    await ensureConsumptionMonthUnlocked({
      month: consumption.month,
      hostelIds: [student.userId?.hostelId],
    });

    consumption.egg_count = counts.egg_count;
    consumption.chicken_count = counts.chicken_count;
    consumption.paneer_count = counts.paneer_count;
    consumption.milk_amount = counts.milk_amount;
    consumption.fine_amount = counts.fine_amount;
    consumption.absent_days = counts.absent_days;
    await consumption.save();

    const populated = await consumption.populate(CONSUMPTION_POPULATE);
    queueConsumptionArtifactSync({ req, month: consumption.month, records: [populated] });

    return res.status(200).json({
      success: true,
      message: "Consumption record updated successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Update consumption error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const getConsumption = async (req, res) => {
  try {
    const { studentId, month } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: "Invalid studentId format." });
    }

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const { error } = await findAuthorizedStudent(studentId, req);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const consumption = await StudentConsumption.findOne({ studentId, month }).populate(CONSUMPTION_POPULATE);
    if (!consumption) {
      return res.status(404).json({ success: false, message: "Consumption record not found." });
    }

    return res.status(200).json({ success: true, data: consumption });
  } catch (error) {
    logger.error("Get consumption error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const deleteConsumption = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid consumption ID." });
    }

    const consumption = await StudentConsumption.findById(id).populate(CONSUMPTION_POPULATE);
    if (!consumption) {
      return res.status(404).json({ success: false, message: "Consumption record not found." });
    }

    const { error, student } = await findAuthorizedStudent(consumption.studentId._id, req);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    await ensureConsumptionMonthUnlocked({
      month: consumption.month,
      hostelIds: [student.userId?.hostelId],
    });

    await StudentConsumption.findByIdAndDelete(id);

    queueConsumptionArtifactSync({ req, month: consumption.month, records: [consumption] });

    return res.status(200).json({
      success: true,
      message: "Consumption record deleted successfully.",
    });
  } catch (error) {
    logger.error("Delete consumption error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const getConsumptionByMonth = async (req, res) => {
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
    }

    const records = await StudentConsumption.find(filter)
      .populate(CONSUMPTION_POPULATE)
      .sort({ createdAt: -1 });

    const filtered = records.filter((record) => {
      if (!isOperationalConsumptionRecord(record)) {
        return false;
      }

      if (req.user.role === "caretaker") {
        return record.studentId?.userId?.hostelId?._id?.toString() === req.user.hostelId.toString();
      }

      return true;
    });

    return res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  } catch (error) {
    logger.error("Get consumption by month error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const bulkUpsertConsumption = async (req, res) => {
  try {
    const { month, records } = req.body;

    if (!month || !MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: "records must be a non-empty array.",
      });
    }

    const studentIds = [...new Set(records.map((record) => record.studentId.toString()))];
    const students = await Student.find({
      _id: { $in: studentIds },
    }).populate({
      path: "userId",
      select: "_id hostelId isActive",
    });

    const studentMap = new Map(students.map((student) => [student._id.toString(), student]));

    if (studentMap.size !== studentIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more students were not found.",
      });
    }

    await ensureConsumptionMonthUnlocked({
      month,
      hostelIds: students.map((student) => student.userId?.hostelId),
    });

    const normalizedRecords = [];
    for (const record of records) {
      if (!record?.studentId || !mongoose.Types.ObjectId.isValid(record.studentId)) {
        return res.status(400).json({
          success: false,
          message: "Each record must include a valid studentId.",
        });
      }

      const counts = resolveCounts(record);
      if (
        [counts.egg_count, counts.chicken_count, counts.paneer_count, counts.milk_amount, counts.fine_amount, counts.absent_days].some(
          (value) => Number.isNaN(value) || value < 0
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "egg_count, chicken_count, paneer_count, milk_amount, fine_amount, and absent_days must be non-negative numbers.",
        });
      }

      const student = studentMap.get(record.studentId.toString());

      if (!isOperationalStudent(student)) {
        return res.status(400).json({
          success: false,
          message: "Inactive students cannot be included in consumption.",
        });
      }

      if (
        req.user.role === "caretaker" &&
        (!req.user.hostelId || student.userId?.hostelId?.toString() !== req.user.hostelId.toString())
      ) {
        return res.status(403).json({
          success: false,
          message: "Student not in your hostel.",
        });
      }

      normalizedRecords.push({
        studentId: record.studentId,
        ...counts,
      });
    }

    const operations = normalizedRecords.map((record) => ({
      updateOne: {
        filter: { studentId: record.studentId, month },
        update: {
          $set: {
            egg_count: record.egg_count,
            chicken_count: record.chicken_count,
            paneer_count: record.paneer_count,
            milk_amount: record.milk_amount,
            fine_amount: record.fine_amount,
            absent_days: record.absent_days,
          },
        },
        upsert: true,
      },
    }));

    await StudentConsumption.bulkWrite(operations, { ordered: false });

    const refreshed = await StudentConsumption.find({
      month,
      studentId: { $in: normalizedRecords.map((record) => record.studentId) },
    })
      .populate(CONSUMPTION_POPULATE)
      .sort({ createdAt: -1 });

    const visibleRefreshed = refreshed.filter(isOperationalConsumptionRecord);

    queueConsumptionArtifactSync({ req, month, records: visibleRefreshed });

    return res.status(200).json({
      success: true,
      message: "Consumption sheet saved successfully.",
      count: visibleRefreshed.length,
      data: visibleRefreshed,
    });
  } catch (error) {
    logger.error("Bulk upsert consumption error", { error: error.message, stack: error.stack });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

module.exports = {
  addConsumption,
  updateConsumption,
  getConsumption,
  deleteConsumption,
  getConsumptionByMonth,
  bulkUpsertConsumption,
};
