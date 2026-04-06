const mongoose = require("mongoose");
const Student = require("../models/Student");

const requestEBL = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: "Invalid studentId format." });
    }

    const student = await Student.findById(studentId).populate("userId");
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    if (req.user.role === "student" && student.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Students can only request EBL for themselves.",
      });
    }

    if (
      req.user.role === "caretaker" &&
      student.userId.hostelId.toString() !== req.user.hostelId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Caretaker can only request EBL for students in their hostel.",
      });
    }

    if (student.userId.eblApproved && student.userId.isEBL) {
      return res.status(409).json({
        success: false,
        message: "EBL is already approved for this student.",
      });
    }

    student.userId.eblApproved = false;
    student.userId.eblRequestPending = true;
    await student.userId.save();

    return res.status(200).json({
      success: true,
      message: "EBL request submitted successfully.",
      data: {
        studentId: student._id,
        isEBL: student.userId.isEBL,
        eblApproved: student.userId.eblApproved,
        eblRequestPending: student.userId.eblRequestPending,
      },
    });
  } catch (error) {
    console.error("Request EBL error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const approveEBL = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { approve } = req.body;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: "Invalid studentId format." });
    }

    const student = await Student.findById(studentId).populate("userId");
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const decision = approve === undefined ? true : Boolean(approve);

    if (decision) {
      student.userId.isEBL = true;
      student.userId.eblApproved = true;
      student.userId.eblRequestPending = false;
      student.isEBL = true;
    } else {
      student.userId.isEBL = false;
      student.userId.eblApproved = false;
      student.userId.eblRequestPending = false;
      student.isEBL = false;
    }

    await student.userId.save();
    await student.save();

    return res.status(200).json({
      success: true,
      message: decision ? "EBL approved successfully." : "EBL request rejected successfully.",
      data: {
        studentId: student._id,
        isEBL: student.userId.isEBL,
        eblApproved: student.userId.eblApproved,
      },
    });
  } catch (error) {
    console.error("Approve EBL error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  requestEBL,
  approveEBL,
};
