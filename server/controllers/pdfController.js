const PDFDocument = require('pdfkit');
const MessBill = require('../models/MessBill');
const Student = require('../models/Student');
const User = require('../models/User');

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

module.exports = {
  generateBillPDF,
  generatePaymentSlipPDF,
};
