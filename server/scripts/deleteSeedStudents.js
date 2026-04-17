require("../config/env");
const mongoose = require("mongoose");

const User = require("../models/User");
const Student = require("../models/Student");
const StudentConsumption = require("../models/StudentConsumption");
const MessBill = require("../models/MessBill");
const Payment = require("../models/Payment");

const DEFAULT_PREFIX = "UHS25HE";

const getArgValue = (flag) => {
  const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.split("=").slice(1).join("=") : undefined;
};

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const prefix = (getArgValue("--prefix") || DEFAULT_PREFIX).trim().toUpperCase();
    const hostelId = getArgValue("--hostelId");

    const studentFilter = {
      studentId: { $regex: `^${prefix}` },
    };

    const students = await Student.find(studentFilter).select("_id userId studentId");
    let scopedStudents = students;

    if (hostelId) {
      const scopedUsers = await User.find({ _id: { $in: students.map((student) => student.userId) }, hostelId }).select("_id");
      const scopedUserIds = new Set(scopedUsers.map((user) => user._id.toString()));
      scopedStudents = students.filter((student) => scopedUserIds.has(student.userId.toString()));
    }

    const studentIds = scopedStudents.map((student) => student._id);
    const userIds = scopedStudents.map((student) => student.userId);

    if (studentIds.length === 0) {
      console.log(`No seeded students found for prefix ${prefix}.`);
      process.exit(0);
    }

    const bills = await MessBill.find({ studentId: { $in: studentIds } }).select("_id");
    const billIds = bills.map((bill) => bill._id);

    await Payment.deleteMany({
      $or: [{ studentId: { $in: studentIds } }, { billId: { $in: billIds } }],
    });
    await StudentConsumption.deleteMany({ studentId: { $in: studentIds } });
    await MessBill.deleteMany({ studentId: { $in: studentIds } });
    await Student.deleteMany({ _id: { $in: studentIds } });
    await User.deleteMany({ _id: { $in: userIds } });

    console.log("Seeded students deleted successfully.");
    console.log(
      JSON.stringify(
        {
          prefix,
          deletedStudents: studentIds.length,
          deletedUsers: userIds.length,
          deletedBills: billIds.length,
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
