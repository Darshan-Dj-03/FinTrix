const { validationResult } = require('express-validator');
const StudentConsumption = require('../models/StudentConsumption');
const Student = require('../models/Student');
const User = require('../models/User');

/**
 * Add new consumption record
 * POST /consumption/add
 * Access: Caretaker only
 */
const addConsumption = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { studentId, month, eggCount, chickenCount, paneerCount } = req.body;

    // Verify student exists and belongs to caretaker's hostel
    const student = await Student.findById(studentId).populate('userId');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.userId.hostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Student not in your hostel' });
    }

    // Check if consumption record already exists
    const existingRecord = await StudentConsumption.findOne({ studentId, month });
    if (existingRecord) {
      return res.status(409).json({ success: false, message: 'Consumption record already exists for this month' });
    }

    const consumption = new StudentConsumption({
      studentId,
      month,
      eggCount: eggCount || 0,
      chickenCount: chickenCount || 0,
      paneerCount: paneerCount || 0,
    });

    await consumption.save();

    res.status(201).json({
      success: true,
      message: 'Consumption record added successfully',
      data: consumption,
    });
  } catch (error) {
    console.error('Add consumption error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Update consumption record
 * PUT /consumption/update/:id
 * Access: Caretaker only
 */
const updateConsumption = async (req, res) => {
  try {
    const { id } = req.params;
    const { eggCount, chickenCount, paneerCount } = req.body;

    const consumption = await StudentConsumption.findById(id).populate('studentId');
    if (!consumption) {
      return res.status(404).json({ success: false, message: 'Consumption record not found' });
    }

    // Verify student belongs to caretaker's hostel
    const student = await Student.findById(consumption.studentId._id).populate('userId');
    if (student.userId.hostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Update counts
    if (eggCount !== undefined) consumption.eggCount = eggCount;
    if (chickenCount !== undefined) consumption.chickenCount = chickenCount;
    if (paneerCount !== undefined) consumption.paneerCount = paneerCount;

    await consumption.save();

    res.status(200).json({
      success: true,
      message: 'Consumption record updated successfully',
      data: consumption,
    });
  } catch (error) {
    console.error('Update consumption error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get consumption record
 * GET /consumption/:studentId/:month
 * Access: Student (own), Caretaker (hostel), Admin (all)
 */
const getConsumption = async (req, res) => {
  try {
    const { studentId, month } = req.params;

    // Access control
    if (req.user.role === 'student') {
      const student = await Student.findById(studentId);
      if (!student || student.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }
    } else if (req.user.role === 'caretaker') {
      const student = await Student.findById(studentId).populate('userId');
      if (!student || student.userId.hostelId.toString() !== req.user.hostelId.toString()) {
        return res.status(403).json({ success: false, message: 'Student not in your hostel' });
      }
    }
    // Admin bypasses checks

    const consumption = await StudentConsumption.findOne({
      studentId,
      month,
    }).populate('studentId');

    if (!consumption) {
      return res.status(404).json({ success: false, message: 'Consumption record not found' });
    }

    res.status(200).json({ success: true, data: consumption });
  } catch (error) {
    console.error('Get consumption error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Delete consumption record
 * DELETE /consumption/:id
 * Access: Caretaker only
 */
const deleteConsumption = async (req, res) => {
  try {
    const { id } = req.params;

    const consumption = await StudentConsumption.findById(id).populate('studentId');
    if (!consumption) {
      return res.status(404).json({ success: false, message: 'Consumption record not found' });
    }

    // Verify student belongs to caretaker's hostel
    const student = await Student.findById(consumption.studentId._id).populate('userId');
    if (student.userId.hostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await StudentConsumption.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: 'Consumption record deleted successfully' });
  } catch (error) {
    console.error('Delete consumption error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get all consumption records for a month
 * GET /consumption/month/:month
 * Access: Admin
 */
const getConsumptionByMonth = async (req, res) => {
  try {
    const { month } = req.params;

    const consumptions = await StudentConsumption.find({ month }).populate('studentId');

    res.status(200).json({
      success: true,
      count: consumptions.length,
      data: consumptions,
    });
  } catch (error) {
    console.error('Get consumption by month error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  addConsumption,
  updateConsumption,
  getConsumption,
  deleteConsumption,
  getConsumptionByMonth,
};
