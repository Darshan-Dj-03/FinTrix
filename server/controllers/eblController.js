const mongoose = require("mongoose");
const Student = require("../models/Student");
const MessBill = require("../models/MessBill");
const { runInTransaction } = require("../utils/transaction");
const { createAuditLog } = require("../services/auditService");
const logger = require("../utils/logger");

const isOperationalStudent = (student) =>
  Boolean(
    student &&
      student.isActive !== false &&
      student.userId &&
      student.userId.isActive !== false
  );

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

    if (!isOperationalStudent(student)) {
      return res.status(400).json({ success: false, message: "Inactive students cannot request EBL." });
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

    await runInTransaction(async (session) => {
      const transactionalStudent = await Student.findById(studentId).populate("userId").session(session);
      transactionalStudent.userId.eblApproved = false;
      transactionalStudent.userId.eblRequestPending = true;
      transactionalStudent.userId.eblRejected = false;
      await transactionalStudent.userId.save({ session });

      await createAuditLog({
        action: "EBL_REQUESTED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: transactionalStudent._id,
        entityType: "Student",
        metadata: {
          userId: transactionalStudent.userId._id,
          hostelId: transactionalStudent.userId.hostelId,
        },
        session,
      });
    });

    const updatedStudent = await Student.findById(studentId).populate("userId");

    return res.status(200).json({
      success: true,
      message: "EBL request submitted successfully.",
      data: {
        studentId: updatedStudent._id,
        isEBL: updatedStudent.userId.isEBL,
        eblApproved: updatedStudent.userId.eblApproved,
        eblRequestPending: updatedStudent.userId.eblRequestPending,
      },
    });
  } catch (error) {
    logger.error("Request EBL error", { error: error.message, stack: error.stack });
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

    if (!isOperationalStudent(student)) {
      return res.status(400).json({ success: false, message: "Inactive students cannot be processed for EBL." });
    }

    const decision = approve === undefined ? true : Boolean(approve);

    await runInTransaction(async (session) => {
      const transactionalStudent = await Student.findById(studentId).populate("userId").session(session);

      if (decision) {
        transactionalStudent.userId.isEBL = true;
        transactionalStudent.userId.eblApproved = true;
        transactionalStudent.userId.eblRequestPending = false;
        transactionalStudent.userId.eblRejected = false;
        transactionalStudent.isEBL = true;

        await MessBill.updateMany(
          {
            studentId: transactionalStudent._id,
            payment_status: { $in: ["pending", "partial"] },
          },
          { $set: { fine: 0 } },
          { session }
        );
      } else {
        transactionalStudent.userId.isEBL = false;
        transactionalStudent.userId.eblApproved = false;
        transactionalStudent.userId.eblRequestPending = false;
        transactionalStudent.userId.eblRejected = true;
        transactionalStudent.isEBL = false;
      }

      await transactionalStudent.userId.save({ session });
      await transactionalStudent.save({ session });

      await createAuditLog({
        action: decision ? "EBL_APPROVED" : "EBL_REJECTED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: transactionalStudent._id,
        entityType: "Student",
        metadata: {
          userId: transactionalStudent.userId._id,
          hostelId: transactionalStudent.userId.hostelId,
        },
        session,
      });
    });

    const updatedStudent = await Student.findById(studentId).populate("userId");

    return res.status(200).json({
      success: true,
      message: decision ? "EBL approved successfully." : "EBL request rejected successfully.",
      data: {
        studentId: updatedStudent._id,
        isEBL: updatedStudent.userId.isEBL,
        eblApproved: updatedStudent.userId.eblApproved,
        eblRequestPending: updatedStudent.userId.eblRequestPending,
        eblRejected: updatedStudent.userId.eblRejected,
      },
    });
  } catch (error) {
    logger.error("Approve EBL error", { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  requestEBL,
  approveEBL,
};
