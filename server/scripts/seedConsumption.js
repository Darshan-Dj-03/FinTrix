require("../config/env");
const mongoose = require("mongoose");

require("../models/User");
const Student = require("../models/Student");
const StudentConsumption = require("../models/StudentConsumption");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

const DEFAULT_EGG_COUNT = 12;
const DEFAULT_CHICKEN_COUNT = 4;
const DEFAULT_PANEER_COUNT = 2;
const DEFAULT_MILK_AMOUNT = 0;

const getArgValue = (flag) => {
  const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.split("=").slice(1).join("=") : undefined;
};

const parseCount = (value, fallback) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const month = getArgValue("--month");
    const hostelId = getArgValue("--hostelId");
    const eggCount = parseCount(getArgValue("--egg"), DEFAULT_EGG_COUNT);
    const chickenCount = parseCount(getArgValue("--chicken"), DEFAULT_CHICKEN_COUNT);
    const paneerCount = parseCount(getArgValue("--paneer"), DEFAULT_PANEER_COUNT);
    const milkAmount = parseCount(getArgValue("--milk"), DEFAULT_MILK_AMOUNT);

    if (!month || !MONTH_REGEX.test(month)) {
      throw new Error('Pass a valid billing month with --month=Mon-YYYY, for example --month=Jan-2026.');
    }

    const studentQuery = { isActive: true };
    const students = await Student.find(studentQuery)
      .populate({
        path: "userId",
        select: "_id hostelId role isActive",
      })
      .select("_id studentId");

    const eligibleStudents = students.filter((student) => {
      if (student.userId?.role !== "student" || student.userId?.isActive === false) {
        return false;
      }

      if (!hostelId) {
        return true;
      }

      return student.userId?.hostelId?.toString() === hostelId;
    });

    if (eligibleStudents.length === 0) {
      throw new Error("No active students found for the given filters.");
    }

    const operations = eligibleStudents.map((student) => ({
      updateOne: {
        filter: {
          studentId: student._id,
          month,
        },
        update: {
          $set: {
            egg_count: eggCount,
            chicken_count: chickenCount,
            paneer_count: paneerCount,
            milk_amount: milkAmount,
          },
        },
        upsert: true,
      },
    }));

    const result = await StudentConsumption.bulkWrite(operations, { ordered: false });

    console.log("Consumption seed completed successfully.");
    console.log(
      JSON.stringify(
        {
          month,
          hostelId: hostelId || null,
          studentsMatched: eligibleStudents.length,
          egg_count: eggCount,
          chicken_count: chickenCount,
          paneer_count: paneerCount,
          milk_amount: milkAmount,
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
