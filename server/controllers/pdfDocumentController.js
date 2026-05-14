const MessBill = require("../models/MessBill");
const Payment = require("../models/Payment");
const Student = require("../models/Student");
const { applyLiveBillState } = require("../services/billLifecycleService");
const {
  createPdfDocument,
  drawUniversityHeader,
  drawContactDetailsBlock,
  drawSectionHeading,
  drawTable,
  drawSummaryPanel,
  drawSignatureBlock,
  formatCurrency,
  formatDate,
  ensureSpace,
} = require("../utils/pdfLayout");
const { resolveReportContacts } = require("../utils/reportContacts");

const MONTH_INDEX = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const toCurrency = (value) => Number(value || 0);

const getDaysInMonth = (monthLabel) => {
  const [monthName, yearText] = String(monthLabel || "").split("-");
  const monthIndex = MONTH_INDEX[monthName];
  const year = Number.parseInt(yearText, 10);

  if (monthIndex === undefined || Number.isNaN(year)) {
    return 0;
  }

  return new Date(year, monthIndex + 1, 0).getDate();
};

const getStudentSortValue = (bill) => {
  const studentCode = bill?.studentId?.studentId || "";
  const numericPart = studentCode.match(/\d+$/)?.[0];
  return numericPart ? Number.parseInt(numericPart, 10) : Number.MAX_SAFE_INTEGER;
};

const sortBillsByStudentId = (bills = []) =>
  [...bills].sort((a, b) => {
    const byNumericId = getStudentSortValue(a) - getStudentSortValue(b);
    if (byNumericId !== 0) {
      return byNumericId;
    }

    return (a?.studentId?.studentId || "").localeCompare(b?.studentId?.studentId || "");
  });

const getDynamicChargeMap = (bill) => {
  const map = {
    establishment: 0,
    maintenance: 0,
    roomRent: 0,
    others: [],
  };

  (bill.dynamic_charge_items || []).forEach((item) => {
    const title = String(item.title || "").trim();
    const amount = toCurrency(item.amount);
    const normalized = title.toLowerCase();

    if (normalized.includes("establish")) {
      map.establishment += amount;
    } else if (normalized.includes("maint")) {
      map.maintenance += amount;
    } else if (normalized.includes("room")) {
      map.roomRent += amount;
    } else {
      map.others.push({ title: title || "Other Charge", amount });
    }
  });

  return map;
};

const getBillBreakdownValues = (bill) => {
  const dynamic = getDynamicChargeMap(bill);
  const foodTotal =
    toCurrency(bill.egg_total) +
    toCurrency(bill.bakery_charge) +
    toCurrency(bill.paneer_total) +
    toCurrency(bill.milk_total) +
    toCurrency(bill.chicken_total);
  const establishmentTotal =
    toCurrency(bill.labour_charge) +
    toCurrency(bill.night_watch_charge) +
    toCurrency(bill.keb_charge);

  return {
    dynamic,
    foodTotal,
    establishmentTotal,
    totalPayable: toCurrency(bill.total_payable !== undefined ? bill.total_payable : bill.total_amount) + toCurrency(bill.fine || 0),
  };
};

const formatPaymentStatusLabel = (value) => {
  if (value === "partial_scholarship_received") {
    return "PARTIALLY PAID - SCHOLARSHIP RECEIVED";
  }
  if (value === "partial_university_claim_received") {
    return "PARTIALLY PAID - UNIVERSITY CLAIM RECEIVED";
  }
  return String(value || "pending").replaceAll("_", " ").toUpperCase();
};

const drawApprovalFooter = (doc, redrawHeader, note) => {
  ensureSpace(doc, 40, redrawHeader);
  doc
    .moveDown(0.2)
    .font("Times-Italic")
    .fontSize(9)
    .fillColor("#475569")
    .text(note || "This is a system-generated institutional record.", {
      align: "center",
    });
};

const generateBillPDF = async (req, res) => {
  try {
    const { studentId, month } = req.params;

    if (req.user.role === "student") {
      const student = await Student.findById(studentId);
      if (!student || student.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: "Unauthorized" });
      }
    }

    const bill = await MessBill.findOne({ studentId, month })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate("studentId")
      .populate({ path: "userId", select: "name username email" })
      .populate({ path: "hostelId", select: "name type location" });

    if (!bill) {
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    const liveBill = applyLiveBillState(bill);
    const breakdown = getBillBreakdownValues(liveBill);
    const doc = createPdfDocument(
      res,
      `hostel-bill-statement-${liveBill.studentId?.studentId || studentId}-${month}.pdf`
    );

    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "HOSTEL BILL STATEMENT",
        hostelName: liveBill.hostelId?.name || "Hostel",
        month,
        generatedBy: liveBill.userId?.name || "Student Account",
        generatedAt: liveBill.createdAt,
        officeLabel: "Office of the Chief Warden",
      });

    renderHeader();

    drawSummaryPanel(doc, {
      title: "Student Information",
      items: [
        { label: "Student Name", value: liveBill.userId?.name || "-" },
        { label: "Student ID", value: liveBill.studentId?.studentId || "-" },
        { label: "Email", value: liveBill.userId?.email || "-" },
        { label: "Gender", value: liveBill.studentId?.gender || "-" },
        { label: "Hostel", value: liveBill.hostelId?.name || "-" },
        { label: "Due Date", value: formatDate(liveBill.due_date) },
      ],
    });

    drawSectionHeading(doc, "Charge Breakdown");
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 210, key: "particular" },
        { label: "Amount", width: 120, key: "amount", align: "right" },
      ],
      rows: [
        ...(Number(liveBill.absence_deduction || 0) > 0
          ? [
              { particular: "Base Mess Before Absence", amount: formatCurrency(liveBill.base_mess_before_absence || 0) },
              {
                particular: `Absent Reduction (${Number(liveBill.absent_days || 0)} days)`,
                amount: formatCurrency(liveBill.absence_deduction || 0),
              },
            ]
          : []),
        { particular: "Monthly Mess Bill", amount: formatCurrency(liveBill.base_mess) },
        { particular: "Egg", amount: formatCurrency(liveBill.egg_total) },
        { particular: "Bakery / Banana", amount: formatCurrency(liveBill.bakery_charge) },
        { particular: "Paneer", amount: formatCurrency(liveBill.paneer_total) },
        { particular: "Milk", amount: formatCurrency(liveBill.milk_total) },
        { particular: "Chicken", amount: formatCurrency(liveBill.chicken_total) },
        { particular: "Establishment", amount: formatCurrency(breakdown.dynamic.establishment) },
        { particular: "Maintenance", amount: formatCurrency(breakdown.dynamic.maintenance) },
        { particular: "Room Rent", amount: formatCurrency(breakdown.dynamic.roomRent) },
        ...breakdown.dynamic.others.map((item) => ({
          particular: item.title,
          amount: formatCurrency(item.amount),
        })),
        { particular: "Labour", amount: formatCurrency(liveBill.labour_charge) },
        { particular: "Night Watch", amount: formatCurrency(liveBill.night_watch_charge) },
        { particular: "Electricity (KEB)", amount: formatCurrency(liveBill.keb_charge) },
        { particular: "Fine", amount: formatCurrency(liveBill.fine) },
      ],
    });

    const billSummaryItems = [
      { label: "Bill Amount", value: formatCurrency(liveBill.total_amount) },
      { label: "Fine", value: formatCurrency(liveBill.fine) },
      { label: "Absent Days", value: String(Number(liveBill.absent_days || 0)) },
        { label: "Absent Reduction", value: formatCurrency(liveBill.absence_deduction || 0) },
    ];

    if (liveBill.is_ebl_student) {
      billSummaryItems.push({
        label: "GOI Amount",
        value: formatCurrency(Math.max(Number(liveBill.total_amount || 0) - Number(liveBill.ebl_difference_amount || 0), 0)),
      });

      if (Number(liveBill.ebl_claimed_amount || 0) > 0) {
        billSummaryItems.push({
          label: "University Claim",
          value: formatCurrency(liveBill.ebl_claimed_amount || 0),
        });
      }

      billSummaryItems.push({
        label: "Balance Amount",
        value: formatCurrency(liveBill.ebl_remaining_balance || 0),
      });
    } else {
      billSummaryItems.push({ label: "Total Payable", value: formatCurrency(breakdown.totalPayable) });
    }

    billSummaryItems.push({
      label: "Payment Status",
      value: formatPaymentStatusLabel(liveBill.payment_status),
    });

    drawSummaryPanel(doc, {
      title: "Bill Summary",
      items: billSummaryItems,
    });

    drawApprovalFooter(
      doc,
      undefined,
      "Prepared for hostel office, student reference, and institutional audit review."
    );
    drawSignatureBlock(doc, {
      leftLabel: "Prepared By Hostel Office",
      rightLabel: "Student / Parent Acknowledgement",
    });

    doc.end();
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({ success: false, message: "Error generating PDF", error: error.message });
  }
};

const generatePaymentSlipPDF = async (req, res) => {
  try {
    const { studentId, month } = req.params;
    const bill = await MessBill.findOne({ studentId, month })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate("studentId")
      .populate({ path: "userId", select: "name email" })
      .populate({ path: "hostelId", select: "name type" });

    if (!bill) {
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    const liveBill = applyLiveBillState(bill);
    const payments = await Payment.find({ billId: bill._id }).sort({ verifiedAt: 1 });
    const paidSoFar = payments.reduce((sum, payment) => sum + toCurrency(payment.amount), 0);
    const totalPayable = toCurrency(
      liveBill.total_payable !== undefined ? liveBill.total_payable : liveBill.total_amount
    ) + toCurrency(liveBill.fine || 0);
    const balanceDue = liveBill.is_ebl_student
      ? Math.max(0, toCurrency(liveBill.ebl_remaining_balance))
      : Math.max(0, totalPayable - paidSoFar);
    const doc = createPdfDocument(
      res,
      `payment-slip-${liveBill.studentId?.studentId || studentId}-${month}.pdf`
    );

    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "STUDENT PAYMENT ADVICE",
        hostelName: liveBill.hostelId?.name || "Hostel",
        month,
        generatedBy: liveBill.userId?.name || "Student Account",
        generatedAt: new Date(),
        officeLabel: "Hostel Fee Collection Record",
      });

    renderHeader();
    drawSummaryPanel(doc, {
      title: "Student Summary",
      items: [
        { label: "Student Name", value: liveBill.userId?.name || "-" },
        { label: "Student ID", value: liveBill.studentId?.studentId || "-" },
        { label: "Email", value: liveBill.userId?.email || "-" },
        { label: "Bill Month", value: month },
        { label: "Due Date", value: formatDate(liveBill.due_date) },
      ],
    });

    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 250, key: "particulars" },
        { label: "Amount", width: 140, key: "amount", align: "right" },
        { label: "Remarks", width: 120, key: "remarks" },
      ],
      rows: [
        { particulars: "Bill Amount", amount: formatCurrency(liveBill.total_amount), remarks: "Monthly hostel bill" },
        { particulars: "Fine", amount: formatCurrency(liveBill.fine), remarks: liveBill.fine > 0 ? "Applied on current bill" : "Nil" },
        ...(liveBill.is_ebl_student
          ? [
              {
                particulars: "GOI Amount",
                amount: formatCurrency(Math.max(Number(liveBill.total_amount || 0) - Number(liveBill.ebl_difference_amount || 0), 0)),
                remarks: "Scholarship sanctioned amount",
              },
              ...(Number(liveBill.ebl_claimed_amount || 0) > 0
                ? [
                    {
                      particulars: "University Claim",
                      amount: formatCurrency(liveBill.ebl_claimed_amount || 0),
                      remarks: "University claim received",
                    },
                  ]
                : []),
              { particulars: "Total Payable", amount: formatCurrency(totalPayable), remarks: "Student balance payable" },
            ]
          : [{ particulars: "Total Payable", amount: formatCurrency(totalPayable), remarks: "Before any payments" }]),
        { particulars: "Paid So Far", amount: formatCurrency(paidSoFar), remarks: `${payments.length} recorded payment(s)` },
        { particulars: "Balance Due", amount: formatCurrency(balanceDue), remarks: formatPaymentStatusLabel(liveBill.payment_status) },
      ],
    });

    if (payments.length) {
      drawSectionHeading(doc, "Payment History");
      drawTable(doc, {
        columns: [
          { label: "Verified On", width: 110, key: "verifiedOn" },
          { label: "Method", width: 70, key: "method" },
          { label: "UTR Number", width: 160, key: "utrNumber" },
          { label: "Amount", width: 100, key: "amount", align: "right" },
        ],
        rows: payments.map((payment) => ({
          verifiedOn: formatDate(payment.verifiedAt || payment.createdAt),
          method: String(payment.paymentMethod || "upi").toUpperCase(),
          utrNumber: payment.utrNumber || "-",
          amount: formatCurrency(payment.amount),
        })),
      });
    }

    drawApprovalFooter(
      doc,
      undefined,
      "Payment advice reflects the current verified collection record of the hostel office."
    );
    drawSignatureBlock(doc, {
      leftLabel: "Verified By Hostel Office",
      rightLabel: "Student Copy",
    });

    doc.end();
  } catch (error) {
    console.error("Payment slip generation error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating payment slip",
      error: error.message,
    });
  }
};

const generateMonthlyMessBillBreakdownPDF = async (req, res) => {
  try {
    const { month } = req.params;
    const query = { month };

    if (req.user.role === "caretaker") {
      if (!req.user.hostelId) {
        return res.status(400).json({ success: false, message: "Caretaker must be assigned to a hostel." });
      }

      query.hostelId = req.user.hostelId;
    } else if (req.query.hostelId) {
      query.hostelId = req.query.hostelId;
    }

    const bills = sortBillsByStudentId(
      await MessBill.find(query)
        .populate({
          path: "studentId",
          select: "studentId gender",
          populate: {
            path: "userId",
            select: "name",
          },
        })
        .populate({ path: "userId", select: "name" })
        .populate({ path: "hostelId", select: "name" })
    ).map((bill) => applyLiveBillState(bill));

    if (!bills.length) {
      return res.status(404).json({ success: false, message: `No bills found for ${month}.` });
    }

    const hostelName = bills[0]?.hostelId?.name || "Hostel";
    const contacts = await resolveReportContacts({
      hostelId: bills[0]?.hostelId?._id || bills[0]?.hostelId,
    });
    const doc = createPdfDocument(res, `mess-bill-per-student-${month}.pdf`, {
      size: "A3",
      layout: "landscape",
      margin: 24,
    });

    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "MESS BILL PER STUDENT",
        hostelName,
        month,
        generatedBy: "Hostel Billing System",
        generatedAt: new Date(),
        officeLabel: "Student-wise Bill Register",
      });

    renderHeader();
    drawContactDetailsBlock(doc, contacts);

    drawSummaryPanel(doc, {
      title: "Register Summary",
      items: [
        { label: "Hostel", value: hostelName },
        { label: "Billing Month", value: month },
        { label: "Students Covered", value: String(bills.length) },
        { label: "Days In Month", value: String(getDaysInMonth(month)) },
      ],
    });

    drawTable(doc, {
      columns: [
        { label: "Student", width: 62, key: "studentCode", fontSize: 8 },
        { label: "Name", width: 82, key: "studentName", fontSize: 8 },
        { label: "Days", width: 34, key: "days", align: "center", fontSize: 8 },
        { label: "Mess Bill", width: 54, key: "messBill", align: "right", fontSize: 8 },
        { label: "Egg", width: 40, key: "egg", align: "right", fontSize: 8 },
        { label: "Bakery", width: 48, key: "bakery", align: "right", fontSize: 8 },
        { label: "Paneer", width: 44, key: "paneer", align: "right", fontSize: 8 },
        { label: "Milk", width: 40, key: "milk", align: "right", fontSize: 8 },
        { label: "Chicken", width: 48, key: "chicken", align: "right", fontSize: 8 },
        { label: "Food Total", width: 54, key: "foodTotal", align: "right", fontSize: 8 },
        { label: "Establ.", width: 48, key: "establishment", align: "right", fontSize: 8 },
        { label: "Maint.", width: 48, key: "maintenance", align: "right", fontSize: 8 },
        { label: "Room", width: 42, key: "roomRent", align: "right", fontSize: 8 },
        { label: "Static", width: 48, key: "dynamicTotal", align: "right", fontSize: 8 },
        { label: "Labour", width: 46, key: "labour", align: "right", fontSize: 8 },
        { label: "Night", width: 44, key: "nightWatch", align: "right", fontSize: 8 },
        { label: "Electric", width: 48, key: "electricity", align: "right", fontSize: 8 },
        { label: "Est. Total", width: 56, key: "estTotal", align: "right", fontSize: 8 },
        { label: "Fine", width: 40, key: "fine", align: "right", fontSize: 8 },
        { label: "Total", width: 52, key: "total", align: "right", fontSize: 8 },
      ],
      rows: bills.map((bill) => {
        const breakdown = getBillBreakdownValues(bill);
        return {
          studentCode: bill.studentId?.studentId || "-",
          studentName: bill.userId?.name || bill.studentId?.userId?.name || "-",
          days: String(getDaysInMonth(month) || "-"),
          messBill: Number(bill.base_mess || 0).toFixed(2),
          egg: Number(bill.egg_total || 0).toFixed(2),
          bakery: Number(bill.bakery_charge || 0).toFixed(2),
          paneer: Number(bill.paneer_total || 0).toFixed(2),
          milk: Number(bill.milk_total || 0).toFixed(2),
          chicken: Number(bill.chicken_total || 0).toFixed(2),
          foodTotal: breakdown.foodTotal.toFixed(2),
          establishment: breakdown.dynamic.establishment.toFixed(2),
          maintenance: breakdown.dynamic.maintenance.toFixed(2),
          roomRent: breakdown.dynamic.roomRent.toFixed(2),
          dynamicTotal: Number(bill.additional_charge || 0).toFixed(2),
          labour: Number(bill.labour_charge || 0).toFixed(2),
          nightWatch: Number(bill.night_watch_charge || 0).toFixed(2),
          electricity: Number(bill.keb_charge || 0).toFixed(2),
          estTotal: breakdown.establishmentTotal.toFixed(2),
          fine: Number(bill.fine || 0).toFixed(2),
          total: breakdown.totalPayable.toFixed(2),
        };
      }),
      fontSize: 7.8,
      rowPadding: 5,
    });

    drawSignatureBlock(doc, {
      signatures: [
        { label: "Caretaker" },
        { label: "Warden" },
        { label: "Dean and Chairman, Hostel Supervisory Committee" },
      ],
      footerDate: new Date(),
    });

    doc.end();
  } catch (error) {
    console.error("Monthly mess bill PDF generation error:", error);
    res.status(500).json({ success: false, message: "Error generating mess bill report PDF", error: error.message });
  }
};

module.exports = {
  generateBillPDF,
  generatePaymentSlipPDF,
  generateMonthlyMessBillBreakdownPDF,
};
