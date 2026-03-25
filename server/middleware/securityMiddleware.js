const Student = require('../models/Student');

/**
 * Check if user owns the student record
 * Used for student self-access verification
 */
const checkOwnership = (studentParamName = 'studentId') => {
  return async (req, res, next) => {
    try {
      const studentId = req.params[studentParamName];
      const student = await Student.findById(studentId);

      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found' });
      }

      // Check if the student's userId matches the authenticated user
      if (student.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource',
        });
      }

      req.student = student;
      next();
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  };
};

/**
 * Check if caretaker can access students in their hostel
 * Admins bypass this check
 */
const restrictToHostel = (studentParamName = 'studentId') => {
  return async (req, res, next) => {
    try {
      // Admins bypass this check
      if (req.user.role === 'admin') {
        return next();
      }

      // Only caretakers and wardens need hostel verification
      if (req.user.role !== 'caretaker' && req.user.role !== 'warden') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const studentId = req.params[studentParamName];
      const student = await Student.findById(studentId).populate('userId');

      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found' });
      }

      // Verify student is in caretaker's/warden's hostel
      if (student.userId.hostelId.toString() !== req.user.hostelId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Student is not in your hostel',
        });
      }

      req.student = student;
      next();
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  };
};

module.exports = {
  checkOwnership,
  restrictToHostel,
};
