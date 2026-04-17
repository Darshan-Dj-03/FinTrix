require("../config/env");
const mongoose = require("mongoose");

const Hostel = require("../models/Hostel");
const User = require("../models/User");
const Student = require("../models/Student");

const DEFAULT_COUNT = 124;
const DEFAULT_PREFIX = "UHS25HE";
const DEFAULT_PASSWORD = "Student@123";
const DEFAULT_EMAIL_DOMAIN = "fintrix.local";

const getArgValue = (flag) => {
  const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.split("=").slice(1).join("=") : undefined;
};

const padNumber = (value) => String(value).padStart(3, "0");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const count = Number(getArgValue("--count") || DEFAULT_COUNT);
    const prefix = (getArgValue("--prefix") || DEFAULT_PREFIX).trim().toUpperCase();
    const hostelId = getArgValue("--hostelId");
    const emailDomain = (getArgValue("--emailDomain") || DEFAULT_EMAIL_DOMAIN).trim().toLowerCase();

    const hostel = hostelId ? await Hostel.findById(hostelId) : await Hostel.findOne().sort({ createdAt: 1 });
    if (!hostel) {
      throw new Error("No hostel found. Create a hostel first or pass --hostelId=<mongoId>.");
    }

    const existingStudentIds = Array.from({ length: count }, (_, index) => `${prefix}${padNumber(index + 1)}`);
    const existingProfiles = await Student.find({ studentId: { $in: existingStudentIds } }).select("studentId");
    if (existingProfiles.length > 0) {
      throw new Error(`Seed aborted. ${existingProfiles.length} student IDs already exist for prefix ${prefix}.`);
    }

    const createdStudentIds = [];

    for (let index = 1; index <= count; index += 1) {
      const studentCode = `${prefix}${padNumber(index)}`;
      const email = `student${padNumber(index)}@${emailDomain}`;
      const gender = index % 2 === 0 ? "female" : "male";

      const user = await User.create({
        name: `Student ${padNumber(index)}`,
        username: studentCode.toLowerCase(),
        email,
        password: DEFAULT_PASSWORD,
        role: "student",
        hostelId: hostel._id,
        isFirstLogin: false,
        isActive: true,
      });

      await Student.create({
        userId: user._id,
        studentId: studentCode,
        gender,
        isActive: true,
      });

      createdStudentIds.push(studentCode);
    }

    console.log("Seed completed successfully.");
    console.log(
      JSON.stringify(
        {
          hostelId: hostel._id.toString(),
          hostelName: hostel.name,
          count: createdStudentIds.length,
          password: DEFAULT_PASSWORD,
          studentIdPrefix: prefix,
          firstStudentId: createdStudentIds[0],
          lastStudentId: createdStudentIds[createdStudentIds.length - 1],
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
