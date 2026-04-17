const nodemailer = require("nodemailer");

const APP_NAME = "FINTRIX";
const ORG_NAME = "University Hostel Administration";

let cachedTransporter = null;

const isEmailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);

const getTransporter = () => {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  return cachedTransporter;
};

const formatCurrency = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const sanitize = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildRows = (rows = []) =>
  rows
    .filter((row) => row && row.label)
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:14px;">${sanitize(row.label)}</td>
          <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${sanitize(row.value)}</td>
        </tr>
      `
    )
    .join("");

const buildEmailShell = ({ title, preheader, greeting, intro, highlight, rows, outro, footerNote }) => `
  <html>
    <body style="margin:0;padding:0;background:#eff6ff;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${sanitize(preheader || title)}</div>
        <div style="background:linear-gradient(135deg,#0f172a,#2563eb);padding:28px 32px;border-radius:24px 24px 0 0;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.3em;text-transform:uppercase;opacity:0.75;">${APP_NAME}</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;">${sanitize(title)}</h1>
          <p style="margin:8px 0 0;font-size:14px;opacity:0.8;">${ORG_NAME}</p>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #dbeafe;border-top:none;border-radius:0 0 24px 24px;">
          <p style="margin:0 0 14px;font-size:15px;">${sanitize(greeting)}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155;">${sanitize(intro)}</p>
          ${
            highlight
              ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:18px;padding:18px 20px;margin:0 0 22px;font-size:15px;font-weight:600;color:#1d4ed8;">${sanitize(highlight)}</div>`
              : ""
          }
          ${
            rows?.length
              ? `<div style="border:1px solid #e2e8f0;border-radius:18px;padding:18px 20px;margin-bottom:22px;">
                  <table style="width:100%;border-collapse:collapse;">${buildRows(rows)}</table>
                </div>`
              : ""
          }
          <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155;">${sanitize(outro)}</p>
          <div style="padding-top:18px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.7;">
            <div>${APP_NAME} automated communication</div>
            <div>${sanitize(footerNote || "Please contact your hostel office for any clarification.")}</div>
          </div>
        </div>
      </div>
    </body>
  </html>
`;

const sendEmail = async ({ to, cc, bcc, subject, html, attachments = [] }) => {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    return { success: false, skipped: true, reason: "Missing recipient email." };
  }

  if (!isEmailConfigured()) {
    return { success: false, skipped: true, reason: "Email credentials are not configured." };
  }

  try {
    const info = await getTransporter().sendMail({
      from: `"${APP_NAME}" <${process.env.EMAIL_USER}>`,
      to,
      cc,
      bcc,
      subject,
      html,
      attachments,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const sendBillEmail = async (studentEmail, studentName, billData = {}, attachments = []) => {
  const {
    month,
    totalAmount,
    dueDate,
    baseMess,
    kebCharge,
    labourCharge,
    nightWatchCharge,
    bakeryCharge,
    eggTotal,
    chickenTotal,
    paneerTotal,
    fine,
    hostelName,
  } = billData;

  return sendEmail({
    to: studentEmail,
    subject: `${APP_NAME} Bill Generated - ${month}`,
    attachments,
    html: buildEmailShell({
      title: "Monthly Bill Generated",
      preheader: `Your ${month} hostel bill is ready.`,
      greeting: `Dear ${studentName || "Student"},`,
      intro: `Your hostel bill for ${month || "the selected month"} has been generated in ${APP_NAME}. The bill PDF is attached for your reference.`,
      highlight: `${hostelName || "Hostel"} billing cycle for ${month || "-"}`,
      rows: [
        { label: "Month", value: month || "-" },
        { label: "Base Mess", value: formatCurrency(baseMess) },
        { label: "Electricity (KEB)", value: formatCurrency(kebCharge) },
        { label: "Labour", value: formatCurrency(labourCharge) },
        { label: "Night Watch", value: formatCurrency(nightWatchCharge) },
        { label: "Bakery / Banana", value: formatCurrency(bakeryCharge) },
        { label: "Egg Charges", value: formatCurrency(eggTotal) },
        { label: "Chicken Charges", value: formatCurrency(chickenTotal) },
        { label: "Paneer Charges", value: formatCurrency(paneerTotal) },
        { label: "Fine", value: formatCurrency(fine) },
        { label: "Total Payable", value: formatCurrency(totalAmount) },
        { label: "Due Date", value: formatDate(dueDate) },
      ],
      outro: "Please review the attached statement and contact your caretaker if any detail needs correction.",
      footerNote: "Student bill statements are issued through FINTRIX for hostel billing and audit reference.",
    }),
  });
};

const sendPaymentConfirmation = async (studentEmail, studentName, paymentData = {}, attachments = []) => {
  const { month, amount, paidAt, utrNumber, paymentMethod, hostelName, balanceDue } = paymentData;

  return sendEmail({
    to: studentEmail,
    subject: `${APP_NAME} Payment Confirmation - ${month}`,
    attachments,
    html: buildEmailShell({
      title: "Payment Confirmed",
      preheader: `Your ${month} payment has been verified.`,
      greeting: `Dear ${studentName || "Student"},`,
      intro: `Your payment has been verified by the hostel office in ${APP_NAME}. The updated statement and payment receipt are attached.`,
      highlight: `Payment recorded successfully for ${hostelName || "your hostel"}`,
      rows: [
        { label: "Month", value: month || "-" },
        { label: "Amount Paid", value: formatCurrency(amount) },
        { label: "Payment Method", value: String(paymentMethod || "upi").toUpperCase() },
        { label: "UTR Number", value: utrNumber || "-" },
        { label: "Verified On", value: formatDate(paidAt) },
        { label: "Remaining Balance", value: formatCurrency(balanceDue) },
      ],
      outro: "Please keep the attached documents for your records. If you notice any mismatch, contact the caretaker immediately.",
      footerNote: "Payment confirmations from FINTRIX reflect the current hostel collection record.",
    }),
  });
};

const sendPaymentReminder = async (studentEmail, studentName, reminderData = {}, attachments = []) => {
  const { month, totalAmount, daysOverdue, dueDate, hostelName } = reminderData;

  return sendEmail({
    to: studentEmail,
    subject: `${APP_NAME} Payment Reminder - ${month}`,
    attachments,
    html: buildEmailShell({
      title: "Payment Reminder",
      preheader: `Your ${month} hostel payment is pending.`,
      greeting: `Dear ${studentName || "Student"},`,
      intro: `This is a reminder that your hostel bill payment is still pending in ${APP_NAME}.`,
      highlight: `${hostelName || "Hostel"} payment follow-up`,
      rows: [
        { label: "Month", value: month || "-" },
        { label: "Amount Due", value: formatCurrency(totalAmount) },
        { label: "Due Date", value: formatDate(dueDate) },
        { label: "Days Overdue", value: String(daysOverdue || 0) },
      ],
      outro: "Please complete the payment as soon as possible to avoid additional fine or delay in processing.",
      footerNote: "Reminder emails are generated automatically from FINTRIX billing records.",
    }),
  });
};

const sendReportNotificationEmail = async ({
  recipientEmail,
  recipientName,
  month,
  hostelName,
  triggerLabel,
  triggeredByName,
  reportNames = [],
  attachments = [],
}) =>
  sendEmail({
    to: recipientEmail,
    subject: `${APP_NAME} Report Package Update - ${month}`,
    attachments,
    html: buildEmailShell({
      title: "Monthly Report Package",
      preheader: `Report documents for ${month} are ready.`,
      greeting: `Dear ${recipientName || "Stakeholder"},`,
      intro: `${triggerLabel || "The monthly report package has been updated"} in ${APP_NAME}. The currently available PDFs are attached for review.`,
      highlight: `${hostelName || "Hostel"} - ${month || "-"}`,
      rows: [
        { label: "Updated By", value: triggeredByName || "FINTRIX System" },
        { label: "Month", value: month || "-" },
        { label: "Hostel", value: hostelName || "-" },
        { label: "Included Reports", value: reportNames.length ? reportNames.join(", ") : "No PDF attachments available" },
      ],
      outro: "Please review the attached report set. This email has been delivered to the relevant warden, dean, and admin stakeholders.",
      footerNote: "FINTRIX report packages support hostel finance review, approvals, and institutional record keeping.",
    }),
  });

const sendApprovalStatusEmail = async ({
  recipientEmail,
  recipientName,
  approverRole,
  approverName,
  month,
  hostelName,
  notes,
  attachments = [],
}) =>
  sendEmail({
    to: recipientEmail,
    subject: `${APP_NAME} Approval Update - ${month}`,
    attachments,
    html: buildEmailShell({
      title: "Approval Recorded",
      preheader: `${approverRole || "Approver"} has completed a report review.`,
      greeting: `Dear ${recipientName || "Caretaker"},`,
      intro: `A report approval has been recorded in ${APP_NAME} for your hostel records.`,
      highlight: `${approverRole || "Approver"} approval received for ${month || "-"}`,
      rows: [
        { label: "Approved By", value: approverName || "-" },
        { label: "Approver Role", value: approverRole || "-" },
        { label: "Month", value: month || "-" },
        { label: "Hostel", value: hostelName || "-" },
        { label: "Notes", value: notes || "No notes added" },
      ],
      outro: "The latest report package is attached for your reference.",
      footerNote: "Approval notifications are delivered by FINTRIX to keep hostel staff aligned on report workflow progress.",
    }),
  });

module.exports = {
  isEmailConfigured,
  sendBillEmail,
  sendPaymentConfirmation,
  sendPaymentReminder,
  sendReportNotificationEmail,
  sendApprovalStatusEmail,
};
