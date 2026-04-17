const PDFDocument = require("pdfkit");

const UNIVERSITY_NAME = "UNIVERSITY OF HORTICULTURAL SCIENCES, BAGALKOTE";
const UNIVERSITY_SUBTITLE = "Hostel Mess Management & Financial Reporting System";

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

const drawUniversityHeader = (doc, { reportTitle, hostelName, month, generatedBy, generatedAt, officeLabel }) => {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc
    .font("Times-Bold")
    .fontSize(17)
    .fillColor("#111827")
    .text(UNIVERSITY_NAME, left, doc.y, { width, align: "center" });

  doc
    .moveDown(0.15)
    .font("Times-Roman")
    .fontSize(10)
    .fillColor("#4b5563")
    .text(UNIVERSITY_SUBTITLE, { width, align: "center" });

  if (officeLabel) {
    doc
      .moveDown(0.1)
      .font("Times-Italic")
      .fontSize(10)
      .fillColor("#475569")
      .text(officeLabel, { width, align: "center" });
  }

  doc
    .moveDown(0.9)
    .font("Times-Bold")
    .fontSize(18)
    .fillColor("#0f172a")
    .text(reportTitle, { width, align: "center" });

  const metaRows = [
    `Hostel: ${hostelName || "-"}`,
    `Month: ${month || "-"}`,
    generatedBy ? `Prepared By: ${generatedBy}` : null,
    generatedAt ? `Prepared On: ${formatDate(generatedAt)}` : null,
  ].filter(Boolean);

  doc.moveDown(0.35).font("Times-Roman").fontSize(10).fillColor("#334155");
  metaRows.forEach((row) => doc.text(row, { width, align: "center" }));

  const ruleY = doc.y + 14;
  doc
    .moveTo(left, ruleY)
    .lineTo(left + width, ruleY)
    .lineWidth(0.8)
    .strokeColor("#cbd5e1")
    .stroke();

  doc.y = ruleY + 14;
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
  const left = doc.page.margins.left;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const drawHeaderRow = () => {
    ensureSpace(doc, 26, redrawHeader);
    let x = left;
    const y = doc.y;
    doc.save();
    doc.rect(left, y, tableWidth, 24).fill(headerFill);
    doc.restore();

    columns.forEach((column) => {
      doc
        .font("Times-Bold")
        .fontSize(9.5)
        .fillColor("#0f172a")
        .text(column.label, x + 5, y + 7, {
          width: column.width - 10,
          align: column.align || "left",
        });
      x += column.width;
    });
    doc.y = y + 24;
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
  const lineHeight = 18;
  const boxHeight = 34 + items.length * lineHeight;
  ensureSpace(doc, boxHeight + 8, redrawHeader);

  const y = doc.y;
  doc.save();
  doc.roundedRect(left, y, width, boxHeight, 10).fill("#f8fafc");
  doc.restore();

  doc.font("Times-Bold").fontSize(12).fillColor("#0f172a").text(title, left + 14, y + 12);
  let currentY = y + 32;
  items.forEach((item) => {
    doc.font("Times-Roman").fontSize(10).fillColor("#334155").text(item.label, left + 14, currentY, {
      width: width * 0.58,
    });
    doc.font("Times-Bold").fontSize(10).fillColor("#0f172a").text(item.value, left + width - 170, currentY, {
      width: 150,
      align: "right",
    });
    currentY += lineHeight;
  });

  doc.y = y + boxHeight + 10;
};

const drawSignatureBlock = (doc, { leftLabel = "Prepared By", rightLabel = "Verified By", redrawHeader }) => {
  ensureSpace(doc, 70, redrawHeader);
  const left = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const lineWidth = 180;
  const topY = doc.y + 18;

  doc.moveTo(left, topY).lineTo(left + lineWidth, topY).strokeColor("#94a3b8").stroke();
  doc.moveTo(left + usableWidth - lineWidth, topY).lineTo(left + usableWidth, topY).strokeColor("#94a3b8").stroke();

  doc.font("Times-Roman").fontSize(10).fillColor("#475569");
  doc.text(leftLabel, left, topY + 6, { width: lineWidth, align: "center" });
  doc.text(rightLabel, left + usableWidth - lineWidth, topY + 6, { width: lineWidth, align: "center" });
  doc.y = topY + 28;
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
  drawSignatureBlock,
  ensureSpace,
  formatCurrency,
  formatDate,
};
