const mongoose = require("mongoose");

const User = require("../models/User");
const Student = require("../models/Student");
const Hostel = require("../models/Hostel");
const StudentSignupRequest = require("../models/StudentSignupRequest");
const { runInTransaction } = require("../utils/transaction");
const { createAuditLog } = require("../services/auditService");
const { sendEmail, buildEmailShell } = require("../utils/mailerService");

const REQUEST_POPULATE = [
  { path: "userId", select: "name email phoneNumber username approvalStatus createdAt" },
  { path: "assignedHostelId", select: "name type location" },
  { path: "caretakerReviewedBy", select: "name role" },
  { path: "adminReviewedBy", select: "name role" },
];

const normalizeCategory = (value = "") => String(value || "").trim().toUpperCase();

const serializeRequest = (request) => ({
  id: request._id,
  status: request.status,
  studentId: request.studentId,
  isTemporaryId: request.isTemporaryId,
  gender: request.gender,
  assignedIsEBL: Boolean(request.assignedIsEBL),
  assignedEblCategory: request.assignedEblCategory || "",
  assignedHostelId: request.assignedHostelId || null,
  caretakerReviewedBy: request.caretakerReviewedBy || null,
  caretakerReviewedAt: request.caretakerReviewedAt,
  adminReviewedBy: request.adminReviewedBy || null,
  adminReviewedAt: request.adminReviewedAt,
  rejectionReason: request.rejectionReason || "",
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
  user: request.userId
    ? {
        id: request.userId._id,
        name: request.userId.name,
        email: request.userId.email,
        phoneNumber: request.userId.phoneNumber || "",
        username: request.userId.username,
        approvalStatus: request.userId.approvalStatus || "approved",
      }
    : null,
});

const listSignupRequests = async (req, res) => {
  try {
    const filter =
      req.user.role === "caretaker"
        ? { status: "pending_caretaker" }
        : req.user.role === "admin"
          ? { status: "pending_admin" }
          : null;

    if (!filter) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    const requests = await StudentSignupRequest.find(filter).populate(REQUEST_POPULATE).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: requests.map(serializeRequest),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const caretakerForwardSignup = async (req, res) => {
  try {
    const { id } = req.params;
    const { hostelId, isEBL, eblCategory = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid signup request id." });
    }

    const payload = await runInTransaction(async (session) => {
      const request = await StudentSignupRequest.findById(id).session(session);
      if (!request) {
        const error = new Error("Signup request not found.");
        error.status = 404;
        throw error;
      }

      if (request.status !== "pending_caretaker") {
        const error = new Error("Only caretaker-pending requests can be forwarded.");
        error.status = 400;
        throw error;
      }

      const user = await User.findById(request.userId).session(session);
      if (!user) {
        const error = new Error("Linked student account not found.");
        error.status = 404;
        throw error;
      }

      const resolvedHostelId = hostelId || req.user.hostelId;
      if (!resolvedHostelId || !mongoose.Types.ObjectId.isValid(resolvedHostelId)) {
        const error = new Error("A valid hostelId is required.");
        error.status = 400;
        throw error;
      }

      const assignedHostel = await Hostel.findById(resolvedHostelId).session(session);
      if (!assignedHostel) {
        const error = new Error("Assigned hostel not found.");
        error.status = 404;
        throw error;
      }

      request.status = "pending_admin";
      request.assignedHostelId = assignedHostel._id;
      request.assignedIsEBL = Boolean(isEBL);
      request.assignedEblCategory = Boolean(isEBL) ? normalizeCategory(eblCategory) : "";
      request.caretakerReviewedBy = req.user._id;
      request.caretakerReviewedAt = new Date();
      request.rejectionReason = "";
      await request.save({ session });

      user.hostelId = assignedHostel._id;
      user.isEBL = Boolean(isEBL);
      user.approvalStatus = "pending_admin";
      await user.save({ session });

      await createAuditLog({
        action: "STUDENT_SIGNUP_CARETAKER_FORWARDED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: request._id,
        entityType: "StudentSignupRequest",
        metadata: {
          userId: user._id,
          hostelId: assignedHostel._id,
          assignedIsEBL: Boolean(isEBL),
        },
        session,
      });

      return StudentSignupRequest.findById(request._id).populate(REQUEST_POPULATE).session(session);
    });

    return res.status(200).json({
      success: true,
      message: "Signup request forwarded to admin.",
      data: serializeRequest(payload),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const caretakerRejectSignup = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid signup request id." });
    }

    const payload = await runInTransaction(async (session) => {
      const request = await StudentSignupRequest.findById(id).session(session);
      if (!request) {
        const error = new Error("Signup request not found.");
        error.status = 404;
        throw error;
      }

      if (request.status !== "pending_caretaker") {
        const error = new Error("Only caretaker-pending requests can be rejected.");
        error.status = 400;
        throw error;
      }

      const user = await User.findById(request.userId).session(session);
      if (!user) {
        const error = new Error("Linked student account not found.");
        error.status = 404;
        throw error;
      }

      request.status = "rejected";
      request.rejectionReason = String(reason || "").trim();
      request.caretakerReviewedBy = req.user._id;
      request.caretakerReviewedAt = new Date();
      await request.save({ session });

      user.approvalStatus = "rejected";
      user.isActive = false;
      await user.save({ session });

      await createAuditLog({
        action: "STUDENT_SIGNUP_CARETAKER_REJECTED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: request._id,
        entityType: "StudentSignupRequest",
        metadata: {
          userId: user._id,
          reason: request.rejectionReason,
        },
        session,
      });

      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: "FINTRIX signup request update",
          html: buildEmailShell({
            title: "Signup Request Rejected",
            preheader: "Your signup request was rejected during caretaker review.",
            greeting: `Dear ${user.name || "Student"},`,
            intro: "Your student signup request was rejected during caretaker review in FINTRIX.",
            highlight: `Student ID: ${request.studentId}`,
            rows: [
              { label: "Review Stage", value: "Caretaker review" },
              { label: "Reason", value: request.rejectionReason || "No reason provided" },
            ],
            outro: "If you need clarification, please contact the hostel office before submitting a fresh request.",
            footerNote: "Signup review notifications are generated automatically from FINTRIX.",
          }),
        });
      }

      return StudentSignupRequest.findById(request._id).populate(REQUEST_POPULATE).session(session);
    });

    return res.status(200).json({
      success: true,
      message: "Signup request rejected.",
      data: serializeRequest(payload),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const adminApproveSignup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid signup request id." });
    }

    const payload = await runInTransaction(async (session) => {
      const request = await StudentSignupRequest.findById(id).session(session);
      if (!request) {
        const error = new Error("Signup request not found.");
        error.status = 404;
        throw error;
      }

      if (request.status !== "pending_admin") {
        const error = new Error("Only admin-pending requests can be approved.");
        error.status = 400;
        throw error;
      }

      const user = await User.findById(request.userId).session(session);
      if (!user) {
        const error = new Error("Linked student account not found.");
        error.status = 404;
        throw error;
      }

      const existingStudent = await Student.findOne({ userId: user._id }).session(session);
      if (!existingStudent) {
        await Student.create(
          [
            {
              userId: user._id,
              studentId: request.studentId,
              gender: request.gender,
              isEBL: Boolean(request.assignedIsEBL),
              eblCategory: Boolean(request.assignedIsEBL) ? normalizeCategory(request.assignedEblCategory) : "",
              isActive: true,
              isTemporaryId: Boolean(request.isTemporaryId),
            },
          ],
          { session }
        );
      }

      user.role = "student";
      user.hostelId = request.assignedHostelId || user.hostelId || null;
      user.isActive = true;
      user.isEBL = Boolean(request.assignedIsEBL);
      user.approvalStatus = "approved";
      await user.save({ session });

      request.status = "approved";
      request.adminReviewedBy = req.user._id;
      request.adminReviewedAt = new Date();
      request.rejectionReason = "";
      await request.save({ session });

      await createAuditLog({
        action: "STUDENT_SIGNUP_ADMIN_APPROVED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: request._id,
        entityType: "StudentSignupRequest",
        metadata: {
          userId: user._id,
          hostelId: user.hostelId,
        },
        session,
      });

      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: "FINTRIX signup approved",
          html: buildEmailShell({
            title: "Signup Approved",
            preheader: "Your student account has been approved.",
            greeting: `Dear ${user.name || "Student"},`,
            intro: "Your FINTRIX student account has been approved successfully. You can now sign in using your student ID and chosen password.",
            highlight: `Approved Student ID: ${request.studentId}`,
            rows: [
              { label: "Hostel", value: "Assigned hostel" },
              { label: "EBL Status", value: request.assignedIsEBL ? `Yes${request.assignedEblCategory ? ` (${request.assignedEblCategory})` : ""}` : "No" },
              { label: "Status", value: "Approved" },
            ],
            outro: "Use your student ID and password on the FINTRIX sign-in page to access your account.",
            footerNote: "Approval notifications are sent automatically from FINTRIX.",
          }),
        });
      }

      return StudentSignupRequest.findById(request._id).populate(REQUEST_POPULATE).session(session);
    });

    return res.status(200).json({
      success: true,
      message: "Student signup approved successfully.",
      data: serializeRequest(payload),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

const adminRejectSignup = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid signup request id." });
    }

    const payload = await runInTransaction(async (session) => {
      const request = await StudentSignupRequest.findById(id).session(session);
      if (!request) {
        const error = new Error("Signup request not found.");
        error.status = 404;
        throw error;
      }

      if (request.status !== "pending_admin") {
        const error = new Error("Only admin-pending requests can be rejected.");
        error.status = 400;
        throw error;
      }

      const user = await User.findById(request.userId).session(session);
      if (!user) {
        const error = new Error("Linked student account not found.");
        error.status = 404;
        throw error;
      }

      request.status = "rejected";
      request.rejectionReason = String(reason || "").trim();
      request.adminReviewedBy = req.user._id;
      request.adminReviewedAt = new Date();
      await request.save({ session });

      user.approvalStatus = "rejected";
      user.isActive = false;
      await user.save({ session });

      await createAuditLog({
        action: "STUDENT_SIGNUP_ADMIN_REJECTED",
        performedBy: req.user._id,
        role: req.user.role,
        entityId: request._id,
        entityType: "StudentSignupRequest",
        metadata: {
          userId: user._id,
          reason: request.rejectionReason,
        },
        session,
      });

      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: "FINTRIX signup request update",
          html: buildEmailShell({
            title: "Signup Request Rejected",
            preheader: "Your signup request was rejected during admin review.",
            greeting: `Dear ${user.name || "Student"},`,
            intro: "Your student signup request was rejected during admin review in FINTRIX.",
            highlight: `Student ID: ${request.studentId}`,
            rows: [
              { label: "Review Stage", value: "Admin review" },
              { label: "Reason", value: request.rejectionReason || "No reason provided" },
            ],
            outro: "If you need clarification, please contact the hostel office before submitting a fresh request.",
            footerNote: "Signup review notifications are generated automatically from FINTRIX.",
          }),
        });
      }

      return StudentSignupRequest.findById(request._id).populate(REQUEST_POPULATE).session(session);
    });

    return res.status(200).json({
      success: true,
      message: "Signup request rejected.",
      data: serializeRequest(payload),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

module.exports = {
  listSignupRequests,
  caretakerForwardSignup,
  caretakerRejectSignup,
  adminApproveSignup,
  adminRejectSignup,
};
