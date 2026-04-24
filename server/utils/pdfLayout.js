const path = require("path");

const PDFDocument = require("pdfkit");

const UNIVERSITY_NAME = "COLLEGE OF HORTICULTURE ENGINEERING AND FOOD TECHNOLOGY";
const UNIVERSITY_SUBTITLE = "DEVIHOSUR, HAVERI";
const UNIVERSITY_SYSTEM_LABEL = "University of Horticultural Sciences, Bagalkote";
const LOGO_PATH = path.resolve(__dirname, "../../client/src/public/college_logo.png");

const formatCurrency = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-IN");
};

const formatDisplayDate = (value) => {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const createPdfDocument = (res, filename, options = {}) => {
  const doc = new PDFDocument({
    size: options.size || "A4",
    layout: options.layout || "portrait",
    margin: options.margin || 48,
    bufferPages: false,
    autoFirstPage: true,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);
  return doc;
};

const createBufferedPdfDocument = (options = {}) => {
  const doc = new PDFDocument({
    size: options.size || "A4",
    layout: options.layout || "portrait",
    margin: options.margin || 48,
    bufferPages: false,
    autoFirstPage: true,
  });

  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  return { doc, done };
};

const drawUniversityHeader = (
  doc,
  { reportTitle, hostelName, month, generatedBy, generatedAt, officeLabel, documentNumber }
) => {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const topY = doc.y;

  doc.font("Times-Bold").fontSize(15).fillColor("#111827").text(UNIVERSITY_NAME, left, topY, {
    width,
    align: "center",
  });

  doc.moveDown(0.08).font("Times-Bold").fontSize(12).fillColor("#111827").text(UNIVERSITY_SUBTITLE, {
    width,
    align: "center",
  });

  doc.moveDown(0.05).font("Times-Roman").fontSize(8.5).fillColor("#475569").text(UNIVERSITY_SYSTEM_LABEL, {
    width,
    align: "center",
  });

  const logoWidth = 38;
  const logoX = left + width / 2 - logoWidth / 2;
  const logoY = doc.y + 4;
  try {
    doc.image(LOGO_PATH, logoX, logoY, {
      fit: [logoWidth, logoWidth],
      align: "center",
    });
  } catch (error) {
    // Continue rendering even if the logo file is unavailable.
  }

  doc.y = logoY + logoWidth + 4;

  doc.font("Times-Bold").fontSize(13).fillColor("#0f172a").text(reportTitle, left, doc.y, {
    width,
    align: "center",
  });

  if (officeLabel) {
    doc.moveDown(0.06).font("Times-Italic").fontSize(8.5).fillColor("#475569").text(officeLabel, {
      width,
      align: "center",
    });
  }

  doc.moveDown(0.25);
  doc.font("Times-Roman").fontSize(9).fillColor("#334155");
  doc.text(`Hostel: ${hostelName || "-"}`, left, doc.y, { width: width * 0.5, align: "left" });
  doc.text(`Date: ${formatDisplayDate(generatedAt || new Date())}`, left + width * 0.5, doc.y, {
    width: width * 0.5,
    align: "right",
  });
  doc.moveDown(0.1);
  doc.text(`Month / Period: ${month || "-"}`, left, doc.y, { width: width * 0.5, align: "left" });
  doc.text(`Prepared By: ${generatedBy || "-"}`, left + width * 0.5, doc.y, {
    width: width * 0.5,
    align: "right",
  });

  if (documentNumber) {
    doc.moveDown(0.1);
    doc.text(`No: ${documentNumber}`, left, doc.y, { width, align: "left" });
  }

  const ruleY = doc.y + 8;
  doc
    .moveTo(left, ruleY)
    .lineTo(left + width, ruleY)
    .lineWidth(0.8)
    .strokeColor("#cbd5e1")
    .stroke();

  doc.y = ruleY + 10;
};

const ensureSpace = (doc, neededHeight, redrawHeader) => {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight <= bottomLimit) {
    return;
  }

  doc.addPage();
  if (typeof redrawHeader === "function") {
    redrawHeader();
  }
};

const drawSectionHeading = (doc, title, redrawHeader) => {
  ensureSpace(doc, 28, redrawHeader);
  doc
    .moveDown(0.2)
    .font("Times-Bold")
    .fontSize(13)
    .fillColor("#0f172a")
    .text(title, doc.page.margins.left, doc.y);
  doc.moveDown(0.15);
};

const getCellHeight = (doc, text, width, font = "Times-Roman", fontSize = 10) => {
  doc.font(font).fontSize(fontSize);
  return doc.heightOfString(String(text ?? "-"), {
    width: width - 10,
    align: "left",
  });
};

const drawTable = (doc, { columns, rows, redrawHeader, zebra = true, headerFill = "#e2e8f0", rowPadding = 6, fontSize = 9.5 }) => {
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const left = doc.page.margins.left + Math.max(0, (usableWidth - tableWidth) / 2);
  const drawHeaderRow = () => {
    const headerHeight = Math.max(
      24,
      ...columns.map((column) =>
        getCellHeight(doc, column.label, column.width, "Times-Bold", column.headerFontSize || 9.5)
      )
    ) + 10;

    ensureSpace(doc, headerHeight + 2, redrawHeader);
    let x = left;
    const y = doc.y;
    doc.save();
    doc.rect(left, y, tableWidth, headerHeight).fill(headerFill);
    doc.restore();

    columns.forEach((column) => {
      doc
        .font("Times-Bold")
        .fontSize(column.headerFontSize || 9.5)
        .fillColor("#0f172a")
        .text(column.label, x + 5, y + 5, {
          width: column.width - 10,
          align: column.align || "left",
        });
      x += column.width;
    });
    doc.y = y + headerHeight;
  };

  drawHeaderRow();

  rows.forEach((row, rowIndex) => {
    const rowHeight = Math.max(
      22,
      ...columns.map((column) =>
        getCellHeight(
          doc,
          typeof column.value === "function" ? column.value(row) : row[column.key],
          column.width,
          "Times-Roman",
          fontSize
        ) + rowPadding * 2
      )
    );

    ensureSpace(doc, rowHeight + 2, () => {
      if (typeof redrawHeader === "function") {
        redrawHeader();
      }
      drawHeaderRow();
    });

    let x = left;
    const y = doc.y;

    if (zebra && rowIndex % 2 === 0) {
      doc.save();
      doc.rect(left, y, tableWidth, rowHeight).fill("#f8fafc");
      doc.restore();
    }

    columns.forEach((column) => {
      const value = typeof column.value === "function" ? column.value(row) : row[column.key];
      doc
        .font(column.font || "Times-Roman")
        .fontSize(column.fontSize || fontSize)
        .fillColor(column.color || "#111827")
        .text(String(value ?? "-"), x + 5, y + rowPadding, {
          width: column.width - 10,
          align: column.align || "left",
        });
      x += column.width;
    });

    doc.y = y + rowHeight;
  });
};

const drawKeyValueTable = (doc, { title, rows, redrawHeader }) => {
  drawSectionHeading(doc, title, redrawHeader);
  drawTable(doc, {
    columns: [
      { label: "Particulars", width: 320 },
      { label: "Amount", width: 170, align: "right" },
      { label: "Details", width: 140 },
    ],
    rows,
    redrawHeader,
    fontSize: 10,
  });
  doc.moveDown(0.45);
};

const drawSummaryPanel = (doc, { title, items, redrawHeader }) => {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelWidth = width * 0.44;
  const valueWidth = width * 0.44;
  const rowGap = 6;
  const rowHeights = items.map((item) => {
    const labelHeight = doc
      .font("Times-Roman")
      .fontSize(10)
      .heightOfString(String(item.label || "-"), { width: labelWidth });
    const valueHeight = doc
      .font("Times-Bold")
      .fontSize(10)
      .heightOfString(String(item.value || "-"), { width: valueWidth, align: "right" });
    return Math.max(labelHeight, valueHeight);
  });
  const contentHeight = rowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, items.length - 1) * rowGap;
  const boxHeight = 44 + contentHeight;
  ensureSpace(doc, boxHeight + 8, redrawHeader);

  const y = doc.y;
  doc.save();
  doc.roundedRect(left, y, width, boxHeight, 10).fill("#f8fafc");
  doc.restore();

  doc.font("Times-Bold").fontSize(12).fillColor("#0f172a").text(title, left + 14, y + 12);
  let currentY = y + 36;
  items.forEach((item, index) => {
    const rowHeight = rowHeights[index];
    doc.font("Times-Roman").fontSize(10).fillColor("#334155").text(item.label, left + 14, currentY, {
      width: labelWidth,
    });
    doc.font("Times-Bold").fontSize(10).fillColor("#0f172a").text(item.value, left + width - valueWidth - 14, currentY, {
      width: valueWidth,
      align: "right",
    });
    currentY += rowHeight + rowGap;
  });

  doc.y = y + boxHeight + 10;
};

const drawContactDetailsBlock = (doc, { warden, caretaker, redrawHeader }) => {
  const left = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = Math.min(250, Math.floor(usableWidth / 2) - 20);
  const lineHeight = 14;
  const blockHeight = 64;

  ensureSpace(doc, blockHeight, redrawHeader);

  const topY = doc.y;
  const drawColumn = (x, title, details, align = "left") => {
    doc.font("Times-Bold").fontSize(10).fillColor("#111827").text(title, x, topY, {
      width: columnWidth,
      align,
    });

    const rows = [
      details?.name || "-",
      `Phone: ${details?.phoneNumber || "-"}`,
      `Email: ${details?.email || "-"}`,
    ];

    let rowY = topY + 14;
    rows.forEach((row) => {
      doc.font("Times-Roman").fontSize(9.5).fillColor("#334155").text(row, x, rowY, {
        width: columnWidth,
        align,
      });
      rowY += lineHeight;
    });
  };

  drawColumn(left, "Warden Details", warden, "left");
  drawColumn(left + usableWidth - columnWidth, "Caretaker Details", caretaker, "right");

  const ruleY = topY + blockHeight - 4;
  doc
    .moveTo(left, ruleY)
    .lineTo(left + usableWidth, ruleY)
    .lineWidth(0.8)
    .strokeColor("#cbd5e1")
    .stroke();

  doc.y = ruleY + 10;
};

const drawSignatureBlock = (
  doc,
  {
    leftLabel = "Warden",
    rightLabel = "Dean and Chairman, Hostel Supervisory Committee",
    redrawHeader,
    footerDate,
    signatures,
  }
) => {
  ensureSpace(doc, 150, redrawHeader);
  const left = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const signatureSlots =
    Array.isArray(signatures) && signatures.length
      ? signatures
      : [{ label: leftLabel }, { label: rightLabel }];
  const slotGap = 22;
  const totalGap = slotGap * Math.max(0, signatureSlots.length - 1);
  const lineWidth = Math.min(170, (usableWidth - totalGap) / signatureSlots.length);
  const dateLabel = `Date: ${formatDisplayDate(footerDate || new Date())}`;
  const dateY = doc.y + 20;
  const topY = dateY + 48;

  doc.font("Times-Roman").fontSize(10).fillColor("#334155").text(dateLabel, left, dateY, {
    width: usableWidth,
    align: "left",
  });

  signatureSlots.forEach((signature, index) => {
    const x = left + index * (lineWidth + slotGap);
    doc.moveTo(x, topY).lineTo(x + lineWidth, topY).strokeColor("#94a3b8").stroke();
    doc.font("Times-Roman").fontSize(10).fillColor("#475569").text(signature.label, x, topY + 8, {
      width: lineWidth,
      align: "center",
    });
  });

  doc.y = topY + 52;
};

module.exports = {
  PDFDocument,
  UNIVERSITY_NAME,
  UNIVERSITY_SUBTITLE,
  createPdfDocument,
  createBufferedPdfDocument,
  drawUniversityHeader,
  drawSectionHeading,
  drawTable,
  drawKeyValueTable,
  drawSummaryPanel,
  drawContactDetailsBlock,
  drawSignatureBlock,
  ensureSpace,
  formatCurrency,
  formatDate,
  formatDisplayDate,
};
