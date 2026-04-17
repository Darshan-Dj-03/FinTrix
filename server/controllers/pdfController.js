/*
const PDFDocument = require('pdfkit');
const MessBill = require('../models/MessBill');
const Student = require('../models/Student');
const User = require('../models/User');

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

  if (numericPart) {
    return Number.parseInt(numericPart, 10);
  }

  return Number.MAX_SAFE_INTEGER;
};

const sortBillsByStudentId = (bills = []) =>
  [...bills].sort((a, b) => {
    const byNumericId = getStudentSortValue(a) - getStudentSortValue(b);
    if (byNumericId !== 0) {
      return byNumericId;
    }

    return (a?.studentId?.studentId || "").localeCompare(b?.studentId?.studentId || "");
  });

/**
 * Generate PDF bill for a student
 * GET /bill/pdf/:studentId/:month
 */
const generateBillPDF = async (req, res) => {
  try {
    const { studentId, month } = req.params;

    // Access control
    if (req.user.role === 'student') {
      const student = await Student.findById(studentId);
      if (!student || student.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }
    }

    // Fetch bill data
    const bill = await MessBill.findOne({ studentId, month })
      .populate('studentId')
      .populate({
        path: 'userId',
        select: 'name username email',
      })
      .populate({
        path: 'hostelId',
        select: 'name type location',
      });

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    // Create PDF document
    const doc = new PDFDocument();

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bill_${studentId}_${month}.pdf"`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('HOSTEL BILL STATEMENT', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('', { align: 'center' });

    // Student and Bill Info
    doc.fontSize(11).font('Helvetica-Bold').text('Student Information:', 0, doc.y + 15);
    doc.fontSize(10).font('Helvetica').text(`Name: ${bill.userId.name}`, 50);
    doc.text(`Email: ${bill.userId.email}`);
    doc.text(`Student ID: ${bill.studentId.studentId}`);
    doc.text(`Gender: ${bill.studentId.gender}`);
    doc.text(`Hostel: ${bill.hostelId.name} (${bill.hostelId.type})`);

    doc.fontSize(11).font('Helvetica-Bold').text('Bill Period:', 0, doc.y + 15);
    doc.fontSize(10).font('Helvetica').text(`Month: ${month}`);
    doc.text(`Generated: ${new Date(bill.createdAt).toLocaleDateString()}`);
    doc.text(`Due Date: ${new Date(bill.due_date).toLocaleDateString()}`);

    // Charge Breakdown Table
    doc.fontSize(12).font('Helvetica-Bold').text('Charge Breakdown', 0, doc.y + 20);

    const chargeItems = [
      ['Description', 'Amount (₹)', 'Quantity/Details'],
    ];

    chargeItems.push(['Base Mess', bill.base_mess.toFixed(2), '']);
    chargeItems.push(['Electricity (KEB)', bill.keb_charge.toFixed(2), '']);
    chargeItems.push(['Labour', bill.labour_charge.toFixed(2), '']);

    if (bill.night_watch_charge > 0) {
      chargeItems.push(['Night Watch', bill.night_watch_charge.toFixed(2), '(Girls Only)']);
    }

    chargeItems.push(['Bakery & Banana', bill.bakery_charge.toFixed(2), '']);

    if (Array.isArray(bill.dynamic_charge_items) && bill.dynamic_charge_items.length > 0) {
      bill.dynamic_charge_items.forEach((item) => {
        chargeItems.push([item.title, Number(item.amount || 0).toFixed(2), 'Static charge']);
      });
      chargeItems.push(['Static Charges Total', bill.additional_charge.toFixed(2), '']);
    } else if (bill.additional_charge > 0) {
      chargeItems.push(['Static Charges', bill.additional_charge.toFixed(2), '']);
    }

    if (bill.egg_count > 0) {
      chargeItems.push(['Eggs', bill.egg_total.toFixed(2), `${bill.egg_count} units`]);
    }

    if (bill.chicken_count > 0) {
      chargeItems.push(['Chicken', bill.chicken_total.toFixed(2), `${bill.chicken_count} units`]);
    }

    if (bill.paneer_count > 0) {
      chargeItems.push(['Paneer', bill.paneer_total.toFixed(2), `${bill.paneer_count} units`]);
    }

    chargeItems.push(['', '', '']);
    chargeItems.push(['Bill Amount', bill.total_amount.toFixed(2), '']);

    if (bill.fine > 0) {
      chargeItems.push(['Late Payment Fine', bill.fine.toFixed(2), `${Math.ceil((new Date() - new Date(bill.due_date)) / (1000 * 60 * 60 * 24))} days late`]);
      const totalWithFine = (parseFloat(bill.total_amount) + parseFloat(bill.fine)).toFixed(2);
      chargeItems.push(['TOTAL PAYABLE', totalWithFine, 'URGENT']);
    }

    // Draw table
    const startX = 50;
    const startY = doc.y + 15;
    const colWidth = 150;
    const rowHeight = 25;
    let currentY = startY;

    chargeItems.forEach((row, index) => {
      const isHeader = index === 0;
      const isBold = index === chargeItems.length - 1 || (bill.fine > 0 && index === chargeItems.length - 2);

      if (isHeader) {
        doc.fillColor('#4CAF50').rect(startX, currentY, 450, rowHeight).fill();
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
      } else if (isBold) {
        doc.fillColor('#f0f0f0').rect(startX, currentY, 450, rowHeight).fill();
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10);
      } else {
        doc.fillColor('#ffffff');
        doc.font('Helvetica').fontSize(10);
      }

      doc.text(row[0], startX + 10, currentY + 5, { width: colWidth - 10 });
      doc.text(row[1], startX + colWidth + 10, currentY + 5, { width: colWidth - 10, align: 'right' });
      doc.text(row[2], startX + colWidth * 2 + 10, currentY + 5, { width: colWidth - 10 });

      currentY += rowHeight;
    });

    // Payment Status
    doc.fontSize(11).font('Helvetica-Bold').text('Payment Status', 0, currentY + 10);
    doc.fontSize(10).font('Helvetica').text(`Status: ${bill.payment_status.toUpperCase()}`);

    if (bill.payment_status === 'unpaid') {
      doc.fillColor('#d32f2f').text('⚠ PAYMENT PENDING - Please pay by the due date', {
        align: 'left',
      });
    } else {
      doc.fillColor('#4CAF50').text('✓ Payment received', { align: 'left' });
    }

    // Footer
    doc.fontSize(9).fillColor('#666666').text(
      'For queries, contact your hostel caretaker. This is an automated bill.',
      { align: 'center', y: doc.y + 20 }
    );

    doc.end();
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ success: false, message: 'Error generating PDF', error: error.message });
  }
};

/**
 * Generate payment slip PDF
 * GET /payment/slip/:studentId/:month
 */
const generatePaymentSlipPDF = async (req, res) => {
  try {
    const { studentId, month } = req.params;

    // Fetch bill data
    const bill = await MessBill.findOne({ studentId, month })
      .populate('studentId')
      .populate({
        path: 'userId',
        select: 'name email',
      })
      .populate({
        path: 'hostelId',
        select: 'name',
      });

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    // Create PDF document
    const doc = new PDFDocument({ size: [216, 279] }); // A4 size

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="slip_${studentId}_${month}.pdf"`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text('PAYMENT SLIP', { align: 'center' });
    doc.fontSize(8).text('Please preserve this slip for your records', { align: 'center' });

    // Student Details
    doc.fontSize(10).font('Helvetica-Bold').text('STUDENT DETAILS', 0, doc.y + 10);
    doc.fontSize(9).font('Helvetica')
      .text(`Name: ${bill.userId.name}`)
      .text(`Hostel: ${bill.hostelId.name}`)
      .text(`Month: ${month}`);

    // Bill Details
    doc.fontSize(10).font('Helvetica-Bold').text('BILL DETAILS', 0, doc.y + 10);
    doc.fontSize(9)
      .font('Helvetica')
      .text(`Bill Amount: ₹${bill.total_amount.toFixed(2)}`)
      .text(`Fine (if applicable): ₹${bill.fine.toFixed(2)}`);

    const totalPayable = (parseFloat(bill.total_amount) + parseFloat(bill.fine)).toFixed(2);
    doc.fontSize(11)
      .font('Helvetica-Bold')
      .text(`TOTAL PAYABLE: ₹${totalPayable}`, { align: 'center', y: doc.y + 5 });

    // Due Date
    doc.fontSize(10)
      .font('Helvetica-Bold')
      .text('Due Date:', 0, doc.y + 10);
    doc.fontSize(9)
      .font('Helvetica')
      .text(new Date(bill.due_date).toLocaleDateString());

    // Payment Instructions
    doc.fontSize(10)
      .font('Helvetica-Bold')
      .text('PAYMENT INSTRUCTIONS', 0, doc.y + 10);
    doc.fontSize(8)
      .font('Helvetica')
      .text('1. Submit payment to hostel caretaker')
      .text('2. Keep this slip as proof of bill')
      .text('3. Late payments attract additional fine');

    doc.end();
  } catch (error) {
    console.error('Payment slip generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating payment slip',
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
        .populate({
          path: "userId",
          select: "name",
        })
        .populate({
          path: "hostelId",
          select: "name",
        })
    );

    if (!bills.length) {
      return res.status(404).json({ success: false, message: `No bills found for ${month}.` });
    }

    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="mess-bill-per-student-${month}.pdf"`
    );
    doc.pipe(res);

    const hostelName = bills[0]?.hostelId?.name || "Hostel";
    const daysInMonth = getDaysInMonth(month);
    const columns = [
      { label: "Student", width: 72, key: "studentId" },
      { label: "Name", width: 110, key: "name" },
      { label: "Days", width: 38, key: "days" },
      { label: "Mess Bill", width: 62, key: "base_mess" },
      { label: "Egg", width: 46, key: "egg_total" },
      { label: "Bakery/Banana", width: 72, key: "bakery_charge" },
      { label: "Paneer", width: 52, key: "paneer_total" },
      { label: "Milk", width: 46, key: "milk_total" },
      { label: "Chicken", width: 58, key: "chicken_total" },
      { label: "Food Total", width: 64, key: "food_total" },
      { label: "Static Charges", width: 120, key: "additional_charge" },
      { label: "Labour", width: 52, key: "labour_charge" },
      { label: "Night", width: 46, key: "night_watch_charge" },
      { label: "Electric", width: 52, key: "keb_charge" },
      { label: "Est. Total", width: 60, key: "establishment_total" },
      { label: "Fine", width: 44, key: "fine" },
      { label: "Total", width: 58, key: "total" },
    ];
    const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const left = doc.page.margins.left;
    const drawHeader = () => {
      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor("#0f172a")
        .text("MESS BILL PER STUDENT", left, 28, { width: tableWidth, align: "center" });
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#475569")
        .text(`${hostelName} • ${month}`, left, doc.y + 4, { width: tableWidth, align: "center" });

      let x = left;
      const headerY = doc.y + 12;
      doc.fillColor("#e2e8f0").rect(left, headerY, tableWidth, 24).fill();
      columns.forEach((column) => {
        doc
          .fillColor("#334155")
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(column.label, x + 4, headerY + 7, { width: column.width - 8, align: "center" });
        x += column.width;
      });
      return headerY + 24;
    };

    let currentY = drawHeader();

    bills.forEach((bill, index) => {
      const foodTotal =
        Number(bill.egg_total || 0) +
        Number(bill.bakery_charge || 0) +
        Number(bill.paneer_total || 0) +
        Number(bill.milk_total || 0) +
        Number(bill.chicken_total || 0);
      const establishmentTotal =
        Number(bill.additional_charge || 0) +
        Number(bill.labour_charge || 0) +
        Number(bill.night_watch_charge || 0) +
        Number(bill.keb_charge || 0);
      const dynamicSummary =
        Array.isArray(bill.dynamic_charge_items) && bill.dynamic_charge_items.length > 0
          ? bill.dynamic_charge_items.map((item) => `${item.title}: ${Number(item.amount || 0).toFixed(2)}`).join("; ")
          : Number(bill.additional_charge || 0).toFixed(2);
      const row = {
        studentId: bill.studentId?.studentId || "-",
        name: bill.userId?.name || bill.studentId?.userId?.name || "-",
        days: String(daysInMonth || "-"),
        base_mess: Number(bill.base_mess || 0).toFixed(2),
        egg_total: Number(bill.egg_total || 0).toFixed(2),
        bakery_charge: Number(bill.bakery_charge || 0).toFixed(2),
        paneer_total: Number(bill.paneer_total || 0).toFixed(2),
        milk_total: Number(bill.milk_total || 0).toFixed(2),
        chicken_total: Number(bill.chicken_total || 0).toFixed(2),
        food_total: foodTotal.toFixed(2),
        additional_charge: dynamicSummary,
        labour_charge: Number(bill.labour_charge || 0).toFixed(2),
        night_watch_charge: Number(bill.night_watch_charge || 0).toFixed(2),
        keb_charge: Number(bill.keb_charge || 0).toFixed(2),
        establishment_total: establishmentTotal.toFixed(2),
        fine: Number(bill.fine || 0).toFixed(2),
        total: (Number(bill.total_amount || 0) + Number(bill.fine || 0)).toFixed(2),
      };

      if (currentY > doc.page.height - 54) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 28 });
        currentY = drawHeader();
      }

      if (index % 2 === 0) {
        doc.fillColor("#f8fafc").rect(left, currentY, tableWidth, 20).fill();
      }

      let x = left;
      columns.forEach((column) => {
        doc
          .fillColor("#0f172a")
          .font("Helvetica")
          .fontSize(7.5)
          .text(row[column.key], x + 3, currentY + 6, { width: column.width - 6, align: "center" });
        x += column.width;
      });

      currentY += 20;
    });

    doc.end();
  } catch (error) {
    console.error("Monthly mess bill PDF generation error:", error);
    res.status(500).json({ success: false, message: "Error generating mess bill report PDF", error: error.message });
  }
};

module.exports = require("./pdfDocumentController");
