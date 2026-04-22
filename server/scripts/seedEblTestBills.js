require("../config/env");
const mongoose = require("mongoose");

const Student = require("../models/Student");
const User = require("../models/User");
const MessBill = require("../models/MessBill");

const DEFAULT_STUDENT_CODE = "UHS25HE025";
const TEST_ANNOUNCEMENT_DATE = new Date("2098-01-01T00:00:00.000Z");
const TEST_DUE_DATE = new Date("2099-12-31T00:00:00.000Z");

const TEST_MONTH_AMOUNTS = {
  "Aug-2024": 2929,
  "Sep-2024": 2760,
  "Oct-2024": 2879,
  "Nov-2024": 2299,
  "Dec-2024": 2903,
  "Jan-2025": 2532,
  "Feb-2025": 2202,
  "Mar-2025": 1953,
  "Apr-2025": 2253,
  "May-2025": 1100,
};

const getArgValue = (flag) => {
  const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.split("=").slice(1).join("=") : undefined;
};

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const studentCode = (getArgValue("--studentId") || DEFAULT_STUDENT_CODE).trim().toUpperCase();

    const student = await Student.findOne({ studentId: studentCode }).populate({
      path: "userId",
      select: "_id name hostelId isActive",
    });

    if (!student || !student.userId) {
      throw new Error(`Student ${studentCode} not found.`);
    }

    if (!student.userId.hostelId) {
      throw new Error(`Student ${studentCode} does not have a hostel assigned.`);
    }

    const seededMonths = [];

    for (const [month, amount] of Object.entries(TEST_MONTH_AMOUNTS)) {
      await MessBill.findOneAndUpdate(
        {
          studentId: student._id,
          month,
        },
        {
          $set: {
            studentId: student._id,
            userId: student.userId._id,
            hostelId: student.userId.hostelId,
            month,
            is_ebl_student: Boolean(student.isEBL),
            ebl_category: student.eblCategory || "",
            base_mess: Number(amount),
            keb_charge: 0,
            labour_charge: 0,
            night_watch_charge: 0,
            bakery_charge: 0,
            additional_charge: 0,
            dynamic_charge_items: [],
            egg_count: 0,
            egg_total: 0,
            chicken_count: 0,
            chicken_total: 0,
            paneer_count: 0,
            paneer_total: 0,
            milk_amount: 0,
            milk_total: 0,
            total_amount: Number(amount),
            fine: 0,
            manual_fine: 0,
            due_date: TEST_DUE_DATE,
            announcement_date: TEST_ANNOUNCEMENT_DATE,
            student_payment_mode: "",
            student_payment_made_date: null,
            student_utr_number: "",
            payment_status: student.isEBL ? "ebl" : "pending",
            amount_paid: 0,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      seededMonths.push({ month, amount });
    }

    console.log("EBL test mess bills seeded successfully.");
    console.log(
      JSON.stringify(
        {
          studentId: student.studentId,
          studentName: student.userId.name,
          hostelId: student.userId.hostelId.toString(),
          dueDate: TEST_DUE_DATE.toISOString(),
          announcementDate: TEST_ANNOUNCEMENT_DATE.toISOString(),
          seededMonths,
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
