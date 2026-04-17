const mongoose = require("mongoose");

const GuestCharge = require("../models/GuestCharge");
const Hostel = require("../models/Hostel");
const { getPagination, buildPaginationMeta } = require("../utils/pagination");
const { createAuditLog } = require("../services/auditService");
const logger = require("../utils/logger");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const populateConfig = [
  { path: "hostelId", select: "name type location" },
  { path: "addedBy", select: "name email role" },
];

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

const validateDates = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: "event_start_date and event_end_date must be valid dates." };
  }

  if (endDate < startDate) {
    return { error: "event_end_date cannot be before event_start_date." };
  }

  return { startDate, endDate };
};

const addGuestCharge = async (req, res) => {
  try {
    const { month, event_name, event_start_date, event_end_date, guest_count, amount, hostelId: providedHostelId } =
      req.body;

    if (!month || !event_name || event_start_date === undefined || event_end_date === undefined || guest_count === undefined || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "month, event_name, event_start_date, event_end_date, guest_count, and amount are required.",
      });
    }

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const numericGuestCount = Number(guest_count);
    const numericAmount = Number(amount);
    if (Number.isNaN(numericGuestCount) || numericGuestCount < 0 || Number.isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "guest_count and amount must be non-negative numbers.",
      });
    }

    const dateValidation = validateDates(event_start_date, event_end_date);
    if (dateValidation.error) {
      return res.status(400).json({ success: false, message: dateValidation.error });
    }

    const resolved = await resolveHostelIdForWrite(req, providedHostelId);
    if (resolved.error) {
      return res.status(400).json({ success: false, message: resolved.error });
    }

    const hostel = await Hostel.findById(resolved.hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: "Hostel not found." });
    }

    const guestCharge = await GuestCharge.create({
      hostelId: resolved.hostelId,
      month,
      event_name: event_name.trim(),
      event_start_date: dateValidation.startDate,
      event_end_date: dateValidation.endDate,
      guest_count: numericGuestCount,
      amount: numericAmount,
      addedBy: req.user._id,
    });

    const populated = await guestCharge.populate(populateConfig);

    await createAuditLog({
      action: "GUEST_CHARGE_CREATED",
      performedBy: req.user._id,
      role: req.user.role,
      entityId: guestCharge._id,
      entityType: "GuestCharge",
      metadata: {
        hostelId: resolved.hostelId,
        month,
        event_name: guestCharge.event_name,
        guest_count: guestCharge.guest_count,
        amount: guestCharge.amount,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Guest charge added successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Add guest charge error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const listGuestChargesByMonth = async (req, res) => {
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

    const { page, limit, skip } = getPagination(req.query);
    const [rows, total] = await Promise.all([
      GuestCharge.find(filter).populate(populateConfig).sort({ event_start_date: 1, createdAt: 1 }).skip(skip).limit(limit),
      GuestCharge.countDocuments(filter),
    ]);

    const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return res.status(200).json({
      success: true,
      message: "Guest charges fetched successfully.",
      data: rows,
      totalAmount,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (error) {
      logger.error("List guest charge error", { error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, message: "Server error." });
  }
};

const updateGuestCharge = async (req, res) => {
  try {
    const { guestChargeId } = req.params;
    const { event_name, event_start_date, event_end_date, guest_count, amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(guestChargeId)) {
      return res.status(400).json({ success: false, message: "Invalid guestChargeId format." });
    }

    const guestCharge = await GuestCharge.findById(guestChargeId);
    if (!guestCharge) {
      return res.status(404).json({ success: false, message: "Guest charge not found." });
    }

    if (req.user.role === "caretaker" && guestCharge.hostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: "You can only update guest charges from your hostel." });
    }

    if (event_name !== undefined) guestCharge.event_name = event_name.trim();
    if (guest_count !== undefined) {
      const numericGuestCount = Number(guest_count);
      if (Number.isNaN(numericGuestCount) || numericGuestCount < 0) {
        return res.status(400).json({ success: false, message: "guest_count must be a non-negative number." });
      }
      guestCharge.guest_count = numericGuestCount;
    }
    if (amount !== undefined) {
      const numericAmount = Number(amount);
      if (Number.isNaN(numericAmount) || numericAmount < 0) {
        return res.status(400).json({ success: false, message: "amount must be a non-negative number." });
      }
      guestCharge.amount = numericAmount;
    }
    if (event_start_date !== undefined || event_end_date !== undefined) {
      const dateValidation = validateDates(
        event_start_date || guestCharge.event_start_date,
        event_end_date || guestCharge.event_end_date
      );
      if (dateValidation.error) {
        return res.status(400).json({ success: false, message: dateValidation.error });
      }
      guestCharge.event_start_date = dateValidation.startDate;
      guestCharge.event_end_date = dateValidation.endDate;
    }

    await guestCharge.save();
    const populated = await guestCharge.populate(populateConfig);

    await createAuditLog({
      action: "GUEST_CHARGE_UPDATED",
      performedBy: req.user._id,
      role: req.user.role,
      entityId: guestCharge._id,
      entityType: "GuestCharge",
      metadata: {
        hostelId: guestCharge.hostelId,
        month: guestCharge.month,
        event_name: guestCharge.event_name,
        guest_count: guestCharge.guest_count,
        amount: guestCharge.amount,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Guest charge updated successfully.",
      data: populated,
    });
  } catch (error) {
    logger.error("Update guest charge error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const deleteGuestCharge = async (req, res) => {
  try {
    const { guestChargeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(guestChargeId)) {
      return res.status(400).json({ success: false, message: "Invalid guestChargeId format." });
    }

    const guestCharge = await GuestCharge.findById(guestChargeId);
    if (!guestCharge) {
      return res.status(404).json({ success: false, message: "Guest charge not found." });
    }

    if (req.user.role === "caretaker" && guestCharge.hostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: "You can only delete guest charges from your hostel." });
    }

    await GuestCharge.findByIdAndDelete(guestChargeId);

    await createAuditLog({
      action: "GUEST_CHARGE_DELETED",
      performedBy: req.user._id,
      role: req.user.role,
      entityId: guestCharge._id,
      entityType: "GuestCharge",
      metadata: {
        hostelId: guestCharge.hostelId,
        month: guestCharge.month,
        event_name: guestCharge.event_name,
        guest_count: guestCharge.guest_count,
        amount: guestCharge.amount,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Guest charge deleted successfully.",
      data: {},
    });
  } catch (error) {
    logger.error("Delete guest charge error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  addGuestCharge,
  listGuestChargesByMonth,
  updateGuestCharge,
  deleteGuestCharge,
};
