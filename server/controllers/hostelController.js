const Hostel = require("../models/Hostel");

/**
 * @route   POST /hostel/create
 * @access  Protected – admin only
 * @desc    Create a new hostel.
 *
 * Body: { name, type, location? }
 */
const createHostel = async (req, res) => {
  try {
    const { name, type, location } = req.body;

    // 1. Validate required fields
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: "name and type are required.",
      });
    }

    // 2. Duplicate name check (also enforced by unique index)
    const existing = await Hostel.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A hostel named "${name.trim()}" already exists.`,
      });
    }

    const hostel = await Hostel.create({
      name: name.trim(),
      type,
      location: location ? location.trim() : null,
    });

    return res.status(201).json({
      success: true,
      message: `Hostel "${hostel.name}" created successfully.`,
      hostel,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Hostel name already exists.",
      });
    }
    // Mongoose enum validation error
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(". ") });
    }
    console.error("Create hostel error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * @route   GET /hostel/all
 * @access  Protected – admin only
 * @desc    Return all hostels sorted by creation date (newest first).
 */
const getAllHostels = async (req, res) => {
  try {
    const hostels = await Hostel.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: hostels.length,
      hostels,
    });
  } catch (error) {
    console.error("Get all hostels error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { createHostel, getAllHostels };
