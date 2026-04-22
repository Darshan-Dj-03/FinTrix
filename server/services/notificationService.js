const User = require("../models/User");
const Report = require("../models/Report");
const MessBill = require("../models/MessBill");
const MessBillReport = require("../models/MessBillReport");
const MonthlyExpenseReport = require("../models/MonthlyExpenseReport");
const Notification = require("../models/Notification");
const {
  buildStudentBillPdfAttachment,
  buildPaymentReceiptPdfAttachment,
  buildMonthlyExpenseReportPdfAttachment,
  buildMainMonthlyReportPdfAttachment,
  buildMessBillPerStudentPdfAttachment,
} = require("./emailAttachmentService");
const {
  isEmailConfigured,
  sendBillEmail,
  sendPaymentConfirmation,
  sendReportNotificationEmail,
  sendApprovalStatusEmail,
} = require("../utils/mailerService");
const logger = require("../utils/logger");

const uniqueByEmail = (users = []) => {
  const seen = new Set();
  return users.filter((user) => {
    const email = String(user?.email || "").trim().toLowerCase();
    if (!email || seen.has(email)) {
      return false;
    }
    seen.add(email);
    return true;
  });
};

const uniqueByUserId = (users = []) => {
  const seen = new Set();
  return users.filter((user) => {
    const id = String(user?._id || "");
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
};

const appendActorRecipient = (users = [], actor = null) => {
  if (!actor?._id) {
    return users;
  }

  return uniqueByUserId([
    ...users,
    {
      _id: actor._id,
      isActive: actor.isActive,
      role: actor.role,
      hostelId: actor.hostelId || null,
      name: actor.name,
      email: actor.email,
    },
  ]);
};

const getDefaultLinkByRole = (role, fallback = "/admin") => {
  if (role === "student") {
    return "/student";
  }

  if (role === "caretaker") {
    return "/caretaker";
  }

  if (["warden", "dean", "admin"].includes(role)) {
    return "/admin";
  }

  return fallback;
};

const getRoleAwareNotificationLink = (role, category, approverRole = "") => {
  switch (category) {
    case "report_generated":
      if (role === "caretaker") return "/caretaker/reports";
      if (["warden", "dean", "admin"].includes(role)) return "/admin/approvals";
      return getDefaultLinkByRole(role);
    case "report_submitted":
      if (role === "caretaker") return "/caretaker/reports";
      if (["warden", "dean", "admin"].includes(role)) return "/admin/approvals";
      return getDefaultLinkByRole(role);
    case "report_approved":
      if (role === "caretaker") return "/caretaker/reports";
      if (["warden", "dean", "admin"].includes(role)) {
        return approverRole === "dean" ? "/admin" : "/admin/approvals";
      }
      return getDefaultLinkByRole(role);
    case "payment_recorded":
      if (role === "student") return "/student/payments";
      if (role === "caretaker") return "/caretaker/payments";
      if (["warden", "dean", "admin"].includes(role)) return "/admin/ledger";
      return getDefaultLinkByRole(role);
    case "payment_updated":
      if (role === "student") return "/student/payments";
      if (role === "caretaker") return "/caretaker/payments";
      if (["warden", "dean", "admin"].includes(role)) return "/admin/approvals";
      return getDefaultLinkByRole(role);
    case "bill_generated":
      if (role === "student") return "/student/bills";
      if (role === "caretaker") return "/caretaker/bills";
      if (["warden", "dean", "admin"].includes(role)) return "/admin/analytics";
      return getDefaultLinkByRole(role);
    default:
      return getDefaultLinkByRole(role);
  }
};

const createNotifications = async (users = [], payload = {}) => {
  const recipients = uniqueByUserId(users).filter((user) => user?.isActive !== false);
  if (!recipients.length) {
    return;
  }

  await Notification.insertMany(
    recipients.map((user) => ({
      userId: user._id,
      type: payload.type || "general",
      title: payload.title || "Notification",
      message: payload.message || "",
      link:
        typeof payload.link === "function"
          ? payload.link(user)
          : payload.link || "",
      metadata: payload.metadata || {},
    }))
  );
};

const buildReportPackage = async ({
  month,
  hostelId,
  includeMainReport = true,
  includeMonthlyExpenseReport = true,
  includeMessBillReport = true,
}) => {
  const [mainReport, monthlyExpenseReport, messBillReport, bills] = await Promise.all([
    Report.findOne({ month, hostelId }).populate("hostelId generatedBy", "name email role"),
    MonthlyExpenseReport.findOne({ month, hostelId }).populate("hostelId generatedBy", "name email role"),
    MessBillReport.findOne({ month, hostelId }).populate("hostelId generatedBy", "name email role"),
    MessBill.find({ month, hostelId })
      .populate("hostelId", "name")
      .populate("studentId", "studentId")
      .populate("userId", "name email")
      .sort({ createdAt: 1 }),
  ]);

  const attachments = [];
  const reportNames = [];
  const hostelName =
    mainReport?.hostelId?.name ||
    monthlyExpenseReport?.hostelId?.name ||
    messBillReport?.hostelId?.name ||
    bills[0]?.hostelId?.name ||
    "Hostel";

  if (includeMainReport && mainReport) {
    attachments.push(await buildMainMonthlyReportPdfAttachment({ report: mainReport }));
    reportNames.push("Main Billing Report");
  }

  if (includeMonthlyExpenseReport && monthlyExpenseReport) {
    attachments.push(await buildMonthlyExpenseReportPdfAttachment({ report: monthlyExpenseReport }));
    reportNames.push("Monthly Expenditure Report");
  }

  if (includeMessBillReport && messBillReport && bills.length) {
    attachments.push(
      await buildMessBillPerStudentPdfAttachment({
        report: messBillReport,
        bills,
        hostelName,
      })
    );
    reportNames.push("Mess Bill Per Student Report");
  }

  return {
    hostelName,
    attachments,
    reportNames,
  };
};

const getReportStakeholders = async (hostelId) =>
  uniqueByEmail(
    await User.find({
      isActive: true,
      $and: [{ role: "warden" }, { $or: [{ hostelId }, { hostelId: null }] }],
    }).select("name email role hostelId")
  );

const getHostelUsersByRoles = async (hostelId, roles = []) =>
  User.find({
    isActive: true,
    role: { $in: roles },
    $or: [{ hostelId }, { hostelId: null }],
  }).select("name email role hostelId");

const getCriticalAudience = async (hostelId, actor = null) => {
  const recipients = await getHostelUsersByRoles(hostelId, ["caretaker", "warden", "dean", "admin"]);
  return appendActorRecipient(recipients, actor);
};

const notifyReportGeneratedInApp = async ({
  month,
  hostelId,
  reportName,
  generatedByName,
  actor = null,
}) => {
  try {
    const recipients = await getCriticalAudience(hostelId, actor);
    await createNotifications(recipients, {
      type: "report_generated",
      title: `${reportName} generated`,
      message: `${generatedByName || "A staff member"} generated the ${reportName.toLowerCase()} for ${month}.`,
      link: (user) => getRoleAwareNotificationLink(user?.role, "report_generated"),
      metadata: { month, hostelId: String(hostelId || ""), reportName },
    });
  } catch (error) {
    logger.warn("In-app report generated notification failed", {
      month,
      hostelId: String(hostelId || ""),
      reportName,
      error: error.message,
    });
  }
};

const notifyReportSubmittedInApp = async ({
  month,
  hostelId,
  reportName,
  submittedByName,
  actor = null,
}) => {
  try {
    const recipients = await getCriticalAudience(hostelId, actor);
    await createNotifications(recipients, {
      type: "report_submitted",
      title: `${reportName} submitted`,
      message: `${submittedByName || "Caretaker"} submitted the ${reportName.toLowerCase()} for ${month}.`,
      link: (user) => getRoleAwareNotificationLink(user?.role, "report_submitted"),
      metadata: { month, hostelId: String(hostelId || ""), reportName },
    });
  } catch (error) {
    logger.warn("In-app report submitted notification failed", {
      month,
      hostelId: String(hostelId || ""),
      reportName,
      error: error.message,
    });
  }
};

const notifyReportApprovedInApp = async ({
  month,
  hostelId,
  reportName,
  approverRole,
  approverName,
  actor = null,
}) => {
  try {
    const recipients = await getCriticalAudience(hostelId, actor);
    await createNotifications(recipients, {
      type: "report_approved",
      title: `${reportName} approved`,
      message: `${approverName || approverRole} approved the ${reportName.toLowerCase()} for ${month}.`,
      link: (user) => getRoleAwareNotificationLink(user?.role, "report_approved", approverRole),
      metadata: { month, hostelId: String(hostelId || ""), reportName, approverRole },
    });
  } catch (error) {
    logger.warn("In-app report approved notification failed", {
      month,
      hostelId: String(hostelId || ""),
      reportName,
      approverRole,
      error: error.message,
    });
  }
};

const notifyStudentPaymentRecordedInApp = async ({ bill, payment }) => {
  try {
    if (!bill?.userId?._id) {
      return;
    }

    const stakeholders = await getHostelUsersByRoles(bill?.hostelId?._id || bill?.hostelId, [
      "caretaker",
      "warden",
      "dean",
      "admin",
    ]);

    await createNotifications(
      appendActorRecipient(
        [
          ...stakeholders,
          { _id: bill.userId._id, isActive: true, role: "student" },
        ],
        payment?.verifiedBy
          ? { _id: payment.verifiedBy, isActive: true }
          : null
      ),
      {
        type: "payment_recorded",
        title: "Payment recorded",
        message: `A payment of Rs. ${Number(payment?.amount || 0).toFixed(2)} was recorded for ${bill.month}.`,
        link: (user) => getRoleAwareNotificationLink(user?.role, "payment_recorded"),
        metadata: {
          month: bill.month,
          billId: String(bill?._id || ""),
          paymentId: String(payment?._id || ""),
        },
      }
    );
  } catch (error) {
    logger.warn("In-app payment notification failed", {
      paymentId: String(payment?._id || ""),
      error: error.message,
    });
  }
};

const notifyCaretakerPaymentUpdatedInApp = async ({ bill, studentName, month }) => {
  try {
    const recipients = await getHostelUsersByRoles(bill?.hostelId, ["caretaker", "warden", "dean", "admin"]);
    await createNotifications(recipients, {
      type: "payment_updated",
      title: "Student payment info updated",
      message: `${studentName || "A student"} updated payment details for the ${month} bill.`,
      link: (user) => getRoleAwareNotificationLink(user?.role, "payment_updated"),
      metadata: {
        month,
        billId: String(bill?._id || ""),
        hostelId: String(bill?.hostelId || ""),
      },
    });
  } catch (error) {
    logger.warn("In-app caretaker payment update notification failed", {
      billId: String(bill?._id || ""),
      error: error.message,
    });
  }
};

const notifyStudentBillGeneratedInApp = async (bill) => {
  try {
    if (!bill?.userId?._id) {
      return;
    }

    await createNotifications([{ _id: bill.userId._id, isActive: true, role: "student" }], {
      type: "bill_generated",
      title: "Mess bill generated",
      message: `Your mess bill for ${bill.month} is now available.`,
      link: (user) => getRoleAwareNotificationLink(user?.role, "bill_generated"),
      metadata: {
        month: bill.month,
        billId: String(bill?._id || ""),
        hostelId: String(bill?.hostelId?._id || bill?.hostelId || ""),
      },
    });
  } catch (error) {
    logger.warn("In-app bill generated notification failed", {
      billId: String(bill?._id || ""),
      error: error.message,
    });
  }
};

const notifyStudentBillGenerated = async (bill) => {
  if (!isEmailConfigured() || !bill?.userId?.email) {
    return;
  }

  try {
    const attachment = await buildStudentBillPdfAttachment({ bill });
    await sendBillEmail(
      bill.userId.email,
      bill.userId.name,
      {
        month: bill.month,
        totalAmount: Number(bill.total_amount || 0) + Number(bill.fine || 0),
        dueDate: bill.due_date,
        baseMess: bill.base_mess,
        kebCharge: bill.keb_charge,
        labourCharge: bill.labour_charge,
        nightWatchCharge: bill.night_watch_charge,
        bakeryCharge: bill.bakery_charge,
        eggTotal: bill.egg_total,
        chickenTotal: bill.chicken_total,
        paneerTotal: bill.paneer_total,
        fine: bill.fine,
        hostelName: bill.hostelId?.name,
      },
      [attachment]
    );
  } catch (error) {
    logger.warn("Student bill email failed", {
      studentId: String(bill?.studentId?._id || bill?.studentId || ""),
      month: bill?.month,
      error: error.message,
    });
  }
};

const notifyStudentPaymentRecorded = async ({ bill, payment }) => {
  if (!isEmailConfigured() || !bill?.userId?.email) {
    return;
  }

  try {
    const [billAttachment, receiptAttachment] = await Promise.all([
      buildStudentBillPdfAttachment({ bill }),
      buildPaymentReceiptPdfAttachment({ bill, payment }),
    ]);

    const totalPayable = Number(bill.total_amount || 0) + Number(bill.fine || 0);
    const paidSoFar = Number(bill.amount_paid || 0);

    await sendPaymentConfirmation(
      bill.userId.email,
      bill.userId.name,
      {
        month: bill.month,
        amount: payment.amount,
        paidAt: payment.verifiedAt || payment.createdAt,
        utrNumber: payment.utrNumber,
        paymentMethod: payment.paymentMethod,
        hostelName: bill.hostelId?.name,
        balanceDue: Math.max(totalPayable - paidSoFar, 0),
      },
      [billAttachment, receiptAttachment]
    );
  } catch (error) {
    logger.warn("Student payment email failed", {
      paymentId: String(payment?._id || ""),
      error: error.message,
    });
  }
};

const notifyReportStakeholders = async ({ month, hostelId, triggeredByName, triggerLabel }) => {
  if (!isEmailConfigured()) {
    return;
  }

  try {
    const recipients = await getReportStakeholders(hostelId);

    if (!recipients.length) {
      return;
    }

    await Promise.allSettled(
      recipients.map(async (recipient) => {
        const packageOptions =
          recipient.role === "dean"
            ? {
                includeMainReport: false,
                includeMonthlyExpenseReport: true,
                includeMessBillReport: false,
              }
            : {
                includeMainReport: true,
                includeMonthlyExpenseReport: true,
                includeMessBillReport: true,
              };

        const { attachments, reportNames, hostelName } = await buildReportPackage({
          month,
          hostelId,
          ...packageOptions,
        });

        if (!attachments.length) {
          return null;
        }

        return sendReportNotificationEmail({
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          month,
          hostelName,
          triggerLabel,
          triggeredByName,
          reportNames,
          attachments,
        });
      })
    );
  } catch (error) {
    logger.warn("Stakeholder report notification failed", {
      month,
      hostelId: String(hostelId || ""),
      error: error.message,
    });
  }
};

const notifyCaretakerApproval = async ({
  month,
  hostelId,
  approverRole,
  approverName,
  notes,
}) => {
  if (!isEmailConfigured()) {
    return;
  }

  return;
};

const notifyEblPeriodVerified = async (period) => {
  if (!isEmailConfigured() || !period?.hostelId) {
    return;
  }

  try {
    const recipients = await getReportStakeholders(period.hostelId._id || period.hostelId);
    if (!recipients.length) {
      return;
    }

    await Promise.allSettled(
      recipients.map((recipient) =>
        sendReportNotificationEmail({
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          month: `${period.fromMonth} to ${period.toMonth}`,
          hostelName: period.hostelId?.name,
          triggerLabel: "An EBL reimbursement period has been prepared and is ready for warden review",
          triggeredByName: period.verifiedBy?.name || "Caretaker",
          reportNames: [
            "EBL reimbursement period",
            `${period.userId?.name || "Student"} (${period.studentId?.studentId || "-"})`,
          ],
          attachments: [],
        })
      )
    );
  } catch (error) {
    logger.warn("EBL verify notification failed", {
      eblPeriodId: String(period?._id || ""),
      error: error.message,
    });
  }
};

const notifyEblPeriodApproved = async (period) => {
  if (!isEmailConfigured() || !period?.userId?.email) {
    return;
  }

  try {
    await sendApprovalStatusEmail({
      recipientEmail: period.userId.email,
      recipientName: period.userId.name,
      approverRole: "Warden",
      approverName: period.approvedByWarden?.name || "Warden",
      month: `${period.fromMonth} to ${period.toMonth}`,
      hostelName: period.hostelId?.name,
      notes: "Your EBL reimbursement period has been approved.",
      attachments: [],
    });
  } catch (error) {
    logger.warn("EBL approval notification failed", {
      eblPeriodId: String(period?._id || ""),
      error: error.message,
    });
  }
};

module.exports = {
  notifyStudentBillGenerated,
  notifyStudentPaymentRecorded,
  notifyReportStakeholders,
  notifyCaretakerApproval,
  notifyEblPeriodVerified,
  notifyEblPeriodApproved,
  notifyReportSubmittedInApp,
  notifyReportGeneratedInApp,
  notifyReportApprovedInApp,
  notifyStudentBillGeneratedInApp,
  notifyStudentPaymentRecordedInApp,
  notifyCaretakerPaymentUpdatedInApp,
};
