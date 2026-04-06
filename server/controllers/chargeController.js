const mongoose = require("mongoose");
const Charge = require("../models/Charge");
const Hostel = require("../models/Hostel");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

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

const addCharge = async (req, res) => {
  try {
    const { month, title, amount, hostelId: providedHostelId } = req.body;

    if (!month || !title || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "month, title, and amount are required.",
      });
    }

    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month must be in "Mon-YYYY" format (e.g. Jan-2026).',
      });
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be a non-negative number.",
      });
    }

    const resolved = await resolveHostelIdForWrite(req, providedHostelId);
    if (resolved.error) {
      return res.status(400).json({ success: false, message: resolved.error });
    }

    const hostel = await Hostel.findById(resolved.hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: "Hostel not found." });
    }

    const charge = await Charge.create({
      hostelId: resolved.hostelId,
      month,
      title: title.trim(),
      amount: numericAmount,
      addedBy: req.user._id,
    });

    const populated = await charge.populate([
      { path: "hostelId", select: "name type location" },
      { path: "addedBy", select: "name username role" },
    ]);

    return res.status(201).json({
      success: true,
      message: "Charge added successfully.",
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Charge with the same title already exists for this hostel and month.",
      });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Add charge error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getChargesByMonth = async (req, res) => {
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
        return res.status(400).json({
          success: false,
          message: "Caretaker is not assigned to any hostel.",
        });
      }
      filter.hostelId = req.user.hostelId;
    } else if (req.query.hostelId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.hostelId)) {
        return res.status(400).json({ success: false, message: "Invalid hostelId format." });
      }
      filter.hostelId = req.query.hostelId;
    }

    const charges = await Charge.find(filter)
      .populate({ path: "hostelId", select: "name type location" })
      .populate({ path: "addedBy", select: "name username role" })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Charges fetched successfully.",
      data: charges,
    });
  } catch (error) {
    console.error("Get charges error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const updateCharge = async (req, res) => {
  try {
    const { chargeId } = req.params;
    const { title, amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(chargeId)) {
      return res.status(400).json({ success: false, message: "Invalid chargeId format." });
    }

    const charge = await Charge.findById(chargeId);
    if (!charge) {
      return res.status(404).json({ success: false, message: "Charge not found." });
    }

    if (
      req.user.role === "caretaker" &&
      charge.hostelId.toString() !== req.user.hostelId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update charges from your hostel.",
      });
    }

    if (title !== undefined) {
      charge.title = title.trim();
    }
    if (amount !== undefined) {
      const numericAmount = Number(amount);
      if (Number.isNaN(numericAmount) || numericAmount < 0) {
        return res.status(400).json({
          success: false,
          message: "amount must be a non-negative number.",
        });
      }
      charge.amount = numericAmount;
    }

    await charge.save();
    const populated = await charge.populate([
      { path: "hostelId", select: "name type location" },
      { path: "addedBy", select: "name username role" },
    ]);

    return res.status(200).json({
      success: true,
      message: "Charge updated successfully.",
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Charge with the same title already exists for this hostel and month.",
      });
    }
    console.error("Update charge error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const deleteCharge = async (req, res) => {
  try {
    const { chargeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chargeId)) {
      return res.status(400).json({ success: false, message: "Invalid chargeId format." });
    }

    const charge = await Charge.findById(chargeId);
    if (!charge) {
      return res.status(404).json({ success: false, message: "Charge not found." });
    }

    if (
      req.user.role === "caretaker" &&
      charge.hostelId.toString() !== req.user.hostelId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only delete charges from your hostel.",
      });
    }

    await Charge.findByIdAndDelete(chargeId);
    return res.status(200).json({
      success: true,
      message: "Charge deleted successfully.",
      data: {},
    });
  } catch (error) {
    console.error("Delete charge error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  addCharge,
  getChargesByMonth,
  updateCharge,
  deleteCharge,
};
