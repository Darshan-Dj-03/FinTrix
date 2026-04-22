require("../config/env");
const mongoose = require("mongoose");

const Student = require("../models/Student");
const MessBill = require("../models/MessBill");
const Payment = require("../models/Payment");
const EblPeriod = require("../models/EblPeriod");

const DEFAULT_STUDENT_CODE = "UHS25HE025";
const TEST_ANNOUNCEMENT_DATE = new Date("2098-01-01T00:00:00.000Z");

const TEST_MONTHS = [
  "Aug-2024",
  "Sep-2024",
  "Oct-2024",
  "Nov-2024",
  "Dec-2024",
  "Jan-2025",
  "Feb-2025",
  "Mar-2025",
  "Apr-2025",
  "May-2025",
];

const getArgValue = (flag) => {
  const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.split("=").slice(1).join("=") : undefined;
};

const monthKey = (month) => {
  const [label, year] = month.split("-");
  const monthOrder = {
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
  return Number(year) * 12 + monthOrder[label];
};

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const studentCode = (getArgValue("--studentId") || DEFAULT_STUDENT_CODE).trim().toUpperCase();
    const purgePeriods = (getArgValue("--purgePeriods") || "true").trim().toLowerCase() !== "false";

    const student = await Student.findOne({ studentId: studentCode });
    if (!student) {
      console.log(`Student ${studentCode} not found. Nothing to delete.`);
      process.exit(0);
    }

    const seededBills = await MessBill.find({
      studentId: student._id,
      month: { $in: TEST_MONTHS },
      announcement_date: TEST_ANNOUNCEMENT_DATE,
    }).select("_id month");

    const billIds = seededBills.map((bill) => bill._id);

    let deletedPeriods = 0;
    if (purgePeriods) {
      const lowerBound = monthKey(TEST_MONTHS[0]);
      const upperBound = monthKey(TEST_MONTHS[TEST_MONTHS.length - 1]);
      const candidatePeriods = await EblPeriod.find({ studentId: student._id }).select("_id fromMonth toMonth");
      const deletablePeriodIds = candidatePeriods
        .filter((period) => {
          const fromKey = monthKey(period.fromMonth);
          const toKey = monthKey(period.toMonth);
          return fromKey >= lowerBound && toKey <= upperBound;
        })
        .map((period) => period._id);

      if (deletablePeriodIds.length) {
        const periodDeleteResult = await EblPeriod.deleteMany({ _id: { $in: deletablePeriodIds } });
        deletedPeriods = periodDeleteResult.deletedCount || 0;
      }
    }

    let deletedPayments = 0;
    if (billIds.length) {
      const paymentDeleteResult = await Payment.deleteMany({ billId: { $in: billIds } });
      deletedPayments = paymentDeleteResult.deletedCount || 0;
    }

    const billDeleteResult = await MessBill.deleteMany({
      _id: { $in: billIds },
    });

    console.log("EBL test mess bills deleted successfully.");
    console.log(
      JSON.stringify(
        {
          studentId: student.studentId,
          deletedBills: billDeleteResult.deletedCount || 0,
          deletedPayments,
          deletedPeriods,
          months: seededBills.map((bill) => bill.month),
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
