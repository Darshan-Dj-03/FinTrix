require("../config/env");
const mongoose = require("mongoose");

const Student = require("../models/Student");

const DEFAULT_PREFIX = "UHS25HE";
const DEFAULT_MALE_COUNT = 51;
const DEFAULT_TOTAL_COUNT = 124;

const getArgValue = (flag) => {
  const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.split("=").slice(1).join("=") : undefined;
};

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const prefix = (getArgValue("--prefix") || DEFAULT_PREFIX).trim().toUpperCase();
    const maleCount = Number(getArgValue("--maleCount") || DEFAULT_MALE_COUNT);
    const totalCount = Number(getArgValue("--totalCount") || DEFAULT_TOTAL_COUNT);

    if (!Number.isInteger(maleCount) || maleCount < 0) {
      throw new Error("maleCount must be a non-negative integer.");
    }

    if (!Number.isInteger(totalCount) || totalCount <= 0) {
      throw new Error("totalCount must be a positive integer.");
    }

    if (maleCount > totalCount) {
      throw new Error("maleCount cannot be greater than totalCount.");
    }

    const students = await Student.find({
      studentId: { $regex: `^${prefix}` },
    })
      .sort({ studentId: 1 })
      .limit(totalCount);

    if (students.length === 0) {
      throw new Error(`No students found for prefix ${prefix}.`);
    }

    if (students.length < totalCount) {
      throw new Error(
        `Expected ${totalCount} students for prefix ${prefix}, but found ${students.length}.`
      );
    }

    const operations = students.map((student, index) => ({
      updateOne: {
        filter: { _id: student._id },
        update: {
          $set: {
            gender: index < maleCount ? "male" : "female",
          },
        },
      },
    }));

    const result = await Student.bulkWrite(operations, { ordered: true });

    console.log("Seeded student genders updated successfully.");
    console.log(
      JSON.stringify(
        {
          prefix,
          totalStudentsUpdated: students.length,
          male: maleCount,
          female: students.length - maleCount,
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
