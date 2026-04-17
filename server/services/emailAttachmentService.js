const {
  createBufferedPdfDocument,
  drawUniversityHeader,
  drawSectionHeading,
  drawTable,
  drawSummaryPanel,
  drawSignatureBlock,
  formatCurrency,
  formatDate,
} = require("../utils/pdfLayout");

const toCurrency = (value) => Number(value || 0);

const finalizePdfAttachment = async (filename, render, options = {}) => {
  const { doc, done } = createBufferedPdfDocument(options);
  render(doc);
  doc.end();
  const content = await done;
  return {
    filename,
    content,
    contentType: "application/pdf",
  };
};

const buildStudentBillPdfAttachment = async ({ bill }) =>
  finalizePdfAttachment(`student-bill-${bill.studentId?.studentId || "bill"}-${bill.month}.pdf`, (doc) => {
    const totalPayable = toCurrency(bill.total_amount) + toCurrency(bill.fine);

    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "STUDENT MESS BILL STATEMENT",
        hostelName: bill.hostelId?.name || "Hostel",
        month: bill.month,
        generatedBy: "FINTRIX Hostel Billing System",
        generatedAt: bill.updatedAt || bill.createdAt,
        officeLabel: "University Hostel Finance Office",
      });

    renderHeader();

    drawSummaryPanel(doc, {
      title: "Student Summary",
      items: [
        { label: "Student Name", value: bill.userId?.name || "-" },
        { label: "Student ID", value: bill.studentId?.studentId || "-" },
        { label: "Email", value: bill.userId?.email || "-" },
        { label: "Hostel", value: bill.hostelId?.name || "-" },
        { label: "Due Date", value: formatDate(bill.due_date) },
      ],
      redrawHeader: renderHeader,
    });

    drawSectionHeading(doc, "Bill Breakdown", renderHeader);
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 280, key: "particular" },
        { label: "Amount", width: 140, key: "amount", align: "right" },
      ],
      rows: [
        { particular: "Monthly Mess Bill", amount: formatCurrency(bill.base_mess) },
        { particular: "Egg Charges", amount: formatCurrency(bill.egg_total) },
        { particular: "Bakery / Banana", amount: formatCurrency(bill.bakery_charge) },
        { particular: "Paneer Charges", amount: formatCurrency(bill.paneer_total) },
        { particular: "Milk Charges", amount: formatCurrency(bill.milk_total) },
        { particular: "Chicken Charges", amount: formatCurrency(bill.chicken_total) },
        { particular: "Static Charges", amount: formatCurrency(bill.additional_charge) },
        { particular: "Labour", amount: formatCurrency(bill.labour_charge) },
        { particular: "Night Watch", amount: formatCurrency(bill.night_watch_charge) },
        { particular: "Electricity (KEB)", amount: formatCurrency(bill.keb_charge) },
        { particular: "Fine", amount: formatCurrency(bill.fine) },
        { particular: "Total Payable", amount: formatCurrency(totalPayable), font: "Times-Bold" },
      ],
      redrawHeader: renderHeader,
      fontSize: 10,
    });

    drawSignatureBlock(doc, {
      leftLabel: "Prepared By FINTRIX",
      rightLabel: "Student Copy",
      redrawHeader: renderHeader,
    });
  });

const buildPaymentReceiptPdfAttachment = async ({ bill, payment }) =>
  finalizePdfAttachment(`payment-receipt-${bill.studentId?.studentId || "student"}-${bill.month}.pdf`, (doc) => {
    const totalPayable = toCurrency(bill.total_amount) + toCurrency(bill.fine);
    const paid = toCurrency(bill.amount_paid);
    const balance = Math.max(totalPayable - paid, 0);

    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "STUDENT PAYMENT CONFIRMATION",
        hostelName: bill.hostelId?.name || "Hostel",
        month: bill.month,
        generatedBy: "FINTRIX Collection Desk",
        generatedAt: payment.verifiedAt || payment.createdAt,
        officeLabel: "University Hostel Finance Office",
      });

    renderHeader();

    drawSummaryPanel(doc, {
      title: "Payment Summary",
      items: [
        { label: "Student Name", value: bill.userId?.name || "-" },
        { label: "Student ID", value: bill.studentId?.studentId || "-" },
        { label: "Payment Method", value: String(payment.paymentMethod || "upi").toUpperCase() },
        { label: "UTR Number", value: payment.utrNumber || "-" },
        { label: "Verified On", value: formatDate(payment.verifiedAt || payment.createdAt) },
      ],
      redrawHeader: renderHeader,
    });

    drawSectionHeading(doc, "Financial Position", renderHeader);
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 280, key: "particular" },
        { label: "Amount", width: 140, key: "amount", align: "right" },
      ],
      rows: [
        { particular: "Current Bill Amount", amount: formatCurrency(bill.total_amount) },
        { particular: "Fine", amount: formatCurrency(bill.fine) },
        { particular: "Total Payable", amount: formatCurrency(totalPayable) },
        { particular: "Payment Received", amount: formatCurrency(payment.amount) },
        { particular: "Paid So Far", amount: formatCurrency(paid) },
        { particular: "Balance Due", amount: formatCurrency(balance) },
      ],
      redrawHeader: renderHeader,
      fontSize: 10,
    });

    drawSignatureBlock(doc, {
      leftLabel: "Verified By FINTRIX",
      rightLabel: "Student Receipt",
      redrawHeader: renderHeader,
    });
  });

const buildMonthlyExpenseReportPdfAttachment = async ({ report }) =>
  finalizePdfAttachment(`monthly-expenditure-report-${report.month}.pdf`, (doc) => {
    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "TOTAL MONTHLY EXPENDITURE REPORT",
        hostelName: report.hostelId?.name || "Hostel",
        month: report.month,
        generatedBy: report.generatedBy?.name || "Caretaker",
        generatedAt: report.createdAt,
        officeLabel: "Office of the Chief Warden",
      });

    renderHeader();

    drawSummaryPanel(doc, {
      title: "Financial Summary",
      items: [
        { label: "MSC Total", value: formatCurrency(report.msc_total) },
        { label: "Closing Balance Last Month", value: formatCurrency(report.closing_balance_last_month) },
        { label: "Total Closing Balance", value: formatCurrency(report.total_closing_balance) },
        { label: "Opening Balance", value: formatCurrency(report.opening_balance) },
        { label: "Total Opening Balance", value: formatCurrency(report.total_opening_balance) },
        { label: "Guest Charges", value: formatCurrency(report.guest_charges) },
        { label: "Total Expenditure", value: formatCurrency(report.total_expenditure) },
        { label: "Mess Bill Per Day", value: formatCurrency(report.mess_bill_per_day) },
      ],
      redrawHeader: renderHeader,
    });

    drawSignatureBlock(doc, {
      leftLabel: "Prepared By Caretaker",
      rightLabel: "For Review",
      redrawHeader: renderHeader,
    });
  });

const buildHostelExpensePdfAttachment = async ({ record }) =>
  finalizePdfAttachment(`hostel-expenditure-details-${record.month}.pdf`, (doc) => {
    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "HOSTEL EXPENDITURE DETAILS REPORT",
        hostelName: record.hostelId?.name || "Hostel",
        month: record.month,
        generatedBy: record.createdBy?.name || "Caretaker",
        generatedAt: record.updatedAt || record.createdAt,
        officeLabel: "Hostel Expenditure Register",
      });

    renderHeader();

    drawSectionHeading(doc, "Core Expense Summary", renderHeader);
    drawTable(doc, {
      columns: [
        { label: "Particulars", width: 280, key: "particular" },
        { label: "Amount", width: 140, key: "amount", align: "right" },
      ],
      rows: [
        { particular: "ELP", amount: formatCurrency(record.elp) },
        { particular: "Chicken", amount: formatCurrency(record.chicken) },
        { particular: "Cylinder", amount: formatCurrency(record.cylinder) },
        { particular: "KEB Total", amount: formatCurrency(record.keb_total) },
        { particular: "Oil", amount: formatCurrency(record.oil) },
        { particular: "Kirani", amount: formatCurrency(record.kirani) },
        { particular: "Milk", amount: formatCurrency(record.milk) },
        { particular: "Labour Bill", amount: formatCurrency(record.labour_bill) },
        { particular: "Night Watch", amount: formatCurrency(record.labour_night_watch) },
        { particular: "Hostel Fund", amount: formatCurrency(record.hostel_fund) },
      ],
      redrawHeader: renderHeader,
      fontSize: 10,
    });

    drawSignatureBlock(doc, {
      leftLabel: "Prepared By Caretaker",
      rightLabel: "For Review",
      redrawHeader: renderHeader,
    });
  });

const buildExpenseSnapshotPdfAttachment = async ({ expense }) =>
  finalizePdfAttachment(`expense-snapshot-${expense.month}.pdf`, (doc) => {
    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "BILLING EXPENSE SNAPSHOT",
        hostelName: expense.hostelId?.name || "Hostel",
        month: expense.month,
        generatedBy: expense.createdBy?.name || "Caretaker",
        generatedAt: expense.updatedAt || expense.createdAt,
        officeLabel: "Monthly Billing Snapshot",
      });

    renderHeader();

    drawSummaryPanel(doc, {
      title: "Snapshot Summary",
      items: [
        { label: "Mess Bill (Monthly)", value: formatCurrency(expense.mess_bill_total) },
        { label: "Mess Bill Per Day", value: formatCurrency(expense.mess_bill_per_day) },
        { label: "Milk Total", value: formatCurrency(expense.milk_total) },
        { label: "Banana / Bakery", value: formatCurrency(expense.banana_bakery_total) },
        { label: "Labour", value: formatCurrency(expense.labour_total) },
        { label: "Electricity", value: formatCurrency(expense.keb_total) },
        { label: "Static Charges", value: formatCurrency(expense.dynamic_charge_total) },
      ],
      redrawHeader: renderHeader,
    });

    drawSignatureBlock(doc, {
      leftLabel: "Prepared By Caretaker",
      rightLabel: "For Review",
      redrawHeader: renderHeader,
    });
  });

const buildMainMonthlyReportPdfAttachment = async ({ report }) =>
  finalizePdfAttachment(`main-billing-report-${report.month}.pdf`, (doc) => {
    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "MAIN BILLING REPORT",
        hostelName: report.hostelId?.name || "Hostel",
        month: report.month,
        generatedBy: report.generatedBy?.name || "Caretaker",
        generatedAt: report.updatedAt || report.createdAt,
        officeLabel: "Hostel Billing and Collections Summary",
      });

    renderHeader();

    drawSummaryPanel(doc, {
      title: "Billing Summary",
      items: [
        { label: "Total Expenses", value: formatCurrency(report.totalExpenses) },
        { label: "Total Billed", value: formatCurrency(report.totalBilled) },
        { label: "Total Collected", value: formatCurrency(report.totalCollected) },
        { label: "Outstanding", value: formatCurrency(report.outstanding) },
        { label: "Status", value: String(report.status || "draft").replace(/_/g, " ").toUpperCase() },
      ],
      redrawHeader: renderHeader,
    });

    drawSignatureBlock(doc, {
      leftLabel: "Prepared By Caretaker",
      rightLabel: "For Review",
      redrawHeader: renderHeader,
    });
  });

const buildMessBillPerStudentPdfAttachment = async ({ report, bills, hostelName }) =>
  finalizePdfAttachment(`mess-bill-per-student-${report.month}.pdf`, (doc) => {
    const renderHeader = () =>
      drawUniversityHeader(doc, {
        reportTitle: "MESS BILL PER STUDENT REPORT",
        hostelName: hostelName || report.hostelId?.name || "Hostel",
        month: report.month,
        generatedBy: report.generatedBy?.name || "Caretaker",
        generatedAt: report.updatedAt || report.createdAt,
        officeLabel: "Student-wise Bill Register",
      });

    renderHeader();

    drawSummaryPanel(doc, {
      title: "Register Summary",
      items: [
        { label: "Students Covered", value: String(report.billCount || bills.length || 0) },
        { label: "Total Billed", value: formatCurrency(report.totalAmount) },
        { label: "Status", value: String(report.status || "draft").replace(/_/g, " ").toUpperCase() },
      ],
      redrawHeader: renderHeader,
    });

    drawSectionHeading(doc, "Student Bill Totals", renderHeader);
    drawTable(doc, {
      columns: [
        { label: "Student", width: 90, key: "studentCode" },
        { label: "Name", width: 170, key: "name" },
        { label: "Total", width: 120, key: "total", align: "right" },
        { label: "Fine", width: 90, key: "fine", align: "right" },
        { label: "Status", width: 90, key: "status", align: "center" },
      ],
      rows: bills.map((bill) => ({
        studentCode: bill.studentId?.studentId || "-",
        name: bill.userId?.name || "-",
        total: formatCurrency(toCurrency(bill.total_amount) + toCurrency(bill.fine)),
        fine: formatCurrency(bill.fine),
        status: String(bill.payment_status || "pending").toUpperCase(),
      })),
      redrawHeader: renderHeader,
      fontSize: 9.5,
    });

    drawSignatureBlock(doc, {
      leftLabel: "Prepared By Caretaker",
      rightLabel: "For Review",
      redrawHeader: renderHeader,
    });
  }, { size: "A4", layout: "portrait" });

module.exports = {
  buildStudentBillPdfAttachment,
  buildPaymentReceiptPdfAttachment,
  buildMonthlyExpenseReportPdfAttachment,
  buildHostelExpensePdfAttachment,
  buildExpenseSnapshotPdfAttachment,
  buildMainMonthlyReportPdfAttachment,
  buildMessBillPerStudentPdfAttachment,
};
