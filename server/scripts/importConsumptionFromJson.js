require("../config/env");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

require("../models/User");
const Student = require("../models/Student");
const StudentConsumption = require("../models/StudentConsumption");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const getArgValue = (flag) => {
  const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.split("=").slice(1).join("=") : undefined;
};

const toCount = (value, fieldName) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }

  return parsed;
};

const normalizeRow = (row, index, defaultMonth) => {
  if (!row || typeof row !== "object") {
    throw new Error(`Row ${index + 1} must be an object.`);
  }

  const studentId = String(row.studentId || "").trim().toUpperCase();
  const month = String(row.month || defaultMonth || "").trim();

  if (!studentId) {
    throw new Error(`Row ${index + 1} is missing studentId.`);
  }

  if (!month || !MONTH_REGEX.test(month)) {
    throw new Error(`Row ${index + 1} must include a valid month in Mon-YYYY format.`);
  }

  return {
    studentId,
    month,
    egg_count: toCount(row.egg_count ?? 0, `Row ${index + 1} egg_count`),
    chicken_count: toCount(row.chicken_count ?? 0, `Row ${index + 1} chicken_count`),
    paneer_count: toCount(row.paneer_count ?? 0, `Row ${index + 1} paneer_count`),
    milk_amount: toCount(row.milk_amount ?? 0, `Row ${index + 1} milk_amount`),
  };
};

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const fileArg = getArgValue("--file");
    const defaultMonth = getArgValue("--month");
    const resolvedFile = path.resolve(
      fileArg || path.join(__dirname, "consumption-import.sample.json")
    );

    if (!fs.existsSync(resolvedFile)) {
      throw new Error(`JSON file not found: ${resolvedFile}`);
    }

    const raw = JSON.parse(fs.readFileSync(resolvedFile, "utf-8"));
    const rows = Array.isArray(raw) ? raw : raw.records;

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("JSON file must contain an array or a { records: [] } object.");
    }

    const normalizedRows = rows.map((row, index) => normalizeRow(row, index, defaultMonth));
    const studentCodes = normalizedRows.map((row) => row.studentId);

    const students = await Student.find({ studentId: { $in: studentCodes } })
      .populate({
        path: "userId",
        select: "_id role isActive hostelId",
      })
      .select("_id studentId");

    const studentMap = new Map(students.map((student) => [student.studentId, student]));

    const missingStudents = studentCodes.filter((studentCode) => !studentMap.has(studentCode));
    if (missingStudents.length > 0) {
      throw new Error(`These student IDs were not found: ${missingStudents.join(", ")}`);
    }

    const invalidUsers = normalizedRows.filter((row) => {
      const student = studentMap.get(row.studentId);
      return student.userId?.role !== "student" || student.userId?.isActive === false;
    });

    if (invalidUsers.length > 0) {
      throw new Error(
        `These students are inactive or invalid users: ${invalidUsers.map((row) => row.studentId).join(", ")}`
      );
    }

    const operations = normalizedRows.map((row) => ({
      updateOne: {
        filter: {
          studentId: studentMap.get(row.studentId)._id,
          month: row.month,
        },
        update: {
          $set: {
            egg_count: row.egg_count,
            chicken_count: row.chicken_count,
            paneer_count: row.paneer_count,
            milk_amount: row.milk_amount,
          },
        },
        upsert: true,
      },
    }));

    const result = await StudentConsumption.bulkWrite(operations, { ordered: false });

    console.log("Consumption import completed successfully.");
    console.log(
      JSON.stringify(
        {
          file: resolvedFile,
          recordsProcessed: normalizedRows.length,
          upserted: result.upsertedCount,
          modified: result.modifiedCount,
        },
        null,
        2
      )
    );

    process.exit(0);
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

run();
