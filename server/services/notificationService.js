const User = require("../models/User");
const Report = require("../models/Report");
const MessBill = require("../models/MessBill");
const MessBillReport = require("../models/MessBillReport");
const MonthlyExpenseReport = require("../models/MonthlyExpenseReport");
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

const buildReportPackage = async ({ month, hostelId }) => {
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

  if (mainReport) {
    attachments.push(await buildMainMonthlyReportPdfAttachment({ report: mainReport }));
    reportNames.push("Main Billing Report");
  }

  if (monthlyExpenseReport) {
    attachments.push(await buildMonthlyExpenseReportPdfAttachment({ report: monthlyExpenseReport }));
    reportNames.push("Monthly Expenditure Report");
  }

  if (messBillReport && bills.length) {
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
    const [{ attachments, reportNames, hostelName }, recipients] = await Promise.all([
      buildReportPackage({ month, hostelId }),
      getReportStakeholders(hostelId),
    ]);

    if (!attachments.length || !recipients.length) {
      return;
    }

    await Promise.allSettled(
      recipients.map((recipient) =>
        sendReportNotificationEmail({
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          month,
          hostelName,
          triggerLabel,
          triggeredByName,
          reportNames,
          attachments,
        })
      )
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

module.exports = {
  notifyStudentBillGenerated,
  notifyStudentPaymentRecorded,
  notifyReportStakeholders,
  notifyCaretakerApproval,
};
