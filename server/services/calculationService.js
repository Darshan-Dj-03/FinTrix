/**
 * Mess Bill Calculation Service
 *
 * Core business logic for generating student-wise monthly mess bills.
 * Keeps calculation logic out of controllers for testability and reusability.
 */

/**
 * Round a monetary value to 2 decimal places.
 * @param {number} value
 * @returns {number}
 */
const { roundUpCurrency, calculateDynamicFine } = require("./billLifecycleService");

const roundTwoDecimals = (value) => Math.round(value * 100) / 100;

const MONTH_INDEX = {
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

const getDaysInMonth = (month) => {
  const [monthLabel, yearLabel] = String(month || "").split("-");
  const monthIndex = MONTH_INDEX[monthLabel];
  const year = Number.parseInt(yearLabel, 10);

  if (monthIndex === undefined || Number.isNaN(year)) {
    return 0;
  }

  return new Date(year, monthIndex + 1, 0).getDate();
};

const calculateAbsenceDeduction = ({ absentDays, daysInMonth, perDayMessBill, monthlyMessBill }) => {
  const safeAbsentDays = Math.max(0, Math.min(daysInMonth, Number(absentDays || 0)));
  const safePerDayMessBill = Math.max(0, Number(perDayMessBill || 0));
  const safeMonthlyMessBill = Math.max(0, Number(monthlyMessBill || 0));

  if (safeAbsentDays <= 4) {
    return 0;
  }

  if (safeAbsentDays <= 9) {
    return roundUpCurrency(safeAbsentDays * 10);
  }

  return roundUpCurrency(safeAbsentDays * safePerDayMessBill);
};

/**
 * Calculate the due date for a bill in a given month.
 *
 * Due date = 20th of the month following the billing month.
 * Example: For Jan-2026, due date is Feb 20, 2026.
 *
 * @param {string} month – "Mon-YYYY" format (e.g. "Jan-2026")
 * @returns {Date}
 */
const calculateDueDate = (month) => {
  const monthMap = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const [monthStr, yearStr] = month.split("-");
  const currentDate = new Date(parseInt(yearStr), monthMap[monthStr], 20);

  // Add one month to get the due date
  currentDate.setMonth(currentDate.getMonth() + 1);

  return currentDate;
};

/**
 * Calculate fine based on payment delay.
 *
 * Rules:
 *   days_late <= 30: fine = days_late × 2
 *   days_late > 30:  fine = (30 × 2) + ((days_late - 30) × 5)
 *
 * @param {Date} dueDate – date bill was due
 * @param {Date} currentDate – today's date (or reference date)
 * @param {boolean} isEBL – whether student is an EBL reimbursement student
 * @param {boolean} eblExemptFine – if true, EBL students get fine = 0 (default: true)
 * @returns {number} – fine amount
 */
const calculateFine = (dueDate, currentDate = new Date(), isEBL = false, eblExemptFine = true) => {
  // EBL students are exempt from fine
  if (isEBL && eblExemptFine) {
    return 0;
  }
  return calculateDynamicFine(dueDate, currentDate);
};

/**
 * Generate mess bills for all active students in a hostel for a given month.
 *
 * Calculation flow:
 * 1. Validate inputs and active student count
 * 2. Segment students into boys and girls
 * 3. Build consumption map from consumption records
 * 4. For each active student, calculate all charge categories
 * 5. Compute total and due date
 * 6. Return array of bill payloads ready to insert into DB
 *
 * @param {Object} expense – Expense document (from DB)
 * @param {Array} students – Array of Student documents with populated userId
 * @param {Array} consumptionRecords – Array of StudentConsumption documents
 * @param {Object} options – Optional configuration
 *   - eblExemptFine (boolean, default true): whether EBL students get fine = 0
 *   - currentDate (Date, default today): used for fine calculation
 * @returns {Array} – Array of bill payloads (ready to insert via MessBill.insertMany)
 * @throws {Error} – If validation fails (e.g., no active students)
 */
const generateMessBills = (expense, students, consumptionRecords = [], options = {}) => {
  const {
    eblExemptFine = true,
    currentDate = new Date(),
    charges = [],
    dueDate = null,
    announcementDate = null,
  } = options;

  // ─── 1. Validate inputs ────────────────────────────────────────────────────────
  if (!expense) {
    throw new Error("Expense record is required");
  }

  if (!Array.isArray(students) || students.length === 0) {
    throw new Error("At least one active student is required to generate bills");
  }

  // ─── 2. Filter active students and segment by gender ──────────────────────────
  const activeStudents = students.filter((s) => s.isActive);

  if (activeStudents.length === 0) {
    throw new Error("No active students found to bill for this month");
  }

  const girls = activeStudents.filter((s) => s.gender === "female");
  const boys = activeStudents.filter((s) => s.gender === "male");

  const totalActiveStudents = activeStudents.length;
  const totalGirls = girls.length;
  const totalBoys = boys.length;

  // ─── 3. Build consumption lookup map ────────────────────────────────────────
  const consumptionMap = {};
  consumptionRecords.forEach((record) => {
    const studentIdStr = record.studentId.toString();
    consumptionMap[studentIdStr] = {
      egg_count: record.egg_count || 0,
      chicken_count: record.chicken_count || 0,
      paneer_count: record.paneer_count || 0,
      milk_amount: record.milk_amount || 0,
      fine_amount: record.fine_amount || 0,
      absent_days: record.absent_days || 0,
    };
  });

  // ─── 4. Calculate per-unit charges ─────────────────────────────────────────────
  // Base mess
  const hasExplicitMilkAmounts = consumptionRecords.some((record) => Number(record.milk_amount || 0) > 0);
  const daysInMonth = getDaysInMonth(expense.month);
  const baseMessMonthly = expense.mess_bill_per_day
    ? roundUpCurrency(expense.mess_bill_per_day * daysInMonth)
    : expense.mess_bill_total
      ? roundUpCurrency(expense.mess_bill_total)
      : roundUpCurrency(
          expense.elp
            + expense.cylinder
            + expense.oil
            + expense.kirana
            + (hasExplicitMilkAmounts ? 0 : expense.milk)
        );
  const derivedMessBillPerDay =
    Number(expense.mess_bill_per_day || 0) > 0
      ? roundUpCurrency(expense.mess_bill_per_day || 0)
      : daysInMonth > 0
        ? roundUpCurrency(baseMessMonthly / daysInMonth)
        : 0;

  // KEB (electricity) – split by gender
  let kebChargePerStudent = 0; // default for assignment
  if (totalGirls > 0) {
    // Will be overridden for each student based on gender
  }
  if (totalBoys > 0) {
    // Will be overridden for each student based on gender
  }

  const kebGirlsPerStudent = totalGirls > 0 ? roundTwoDecimals(expense.keb_girls / totalGirls) : 0;
  const kebBoysPerStudent = totalBoys > 0 ? roundTwoDecimals(expense.keb_boys / totalBoys) : 0;

  // Labour
  const labourChargePerStudent = roundUpCurrency(expense.labour_total / totalActiveStudents);

  // Night watch (girls only)
  const nightWatchChargePerStudent = totalGirls > 0 ? roundUpCurrency(expense.night_watch_total / totalGirls) : 0;

  // Bakery + Banana
  const bakeryBananaTotalAmount = expense.banana_bakery_total || (expense.bakery_total + expense.banana_total);
  const bakeryChargePerStudent = roundUpCurrency(bakeryBananaTotalAmount / totalActiveStudents);

  // Dynamic charges
  const dynamicChargeItems = charges
    .map((charge) => ({
      title: charge.title || "Static Charge",
      amount: roundTwoDecimals(Number(charge.amount) || 0),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const totalDynamicCharges = dynamicChargeItems.reduce((sum, charge) => sum + charge.amount, 0);

  // ─── 5. Generate bill for each active student ──────────────────────────────────
  const bills = activeStudents.map((student) => {
    const studentIdStr = student._id.toString();
    const consumption = consumptionMap[studentIdStr] || {
      egg_count: 0,
      chicken_count: 0,
      paneer_count: 0,
      milk_amount: 0,
      fine_amount: 0,
      absent_days: 0,
    };

    // Determine KEB charge based on student gender
    const kebCharge = roundUpCurrency(student.gender === "female" ? kebGirlsPerStudent : kebBoysPerStudent);

    // Night watch only for girls
    const nightWatchCharge = student.gender === "female" ? roundUpCurrency(nightWatchChargePerStudent) : 0;

    // Unit item totals
    const eggTotal = roundUpCurrency(expense.egg_price * consumption.egg_count);
    const chickenTotal = roundUpCurrency(expense.chicken_price * consumption.chicken_count);
    const paneerTotal = roundUpCurrency(expense.paneer_price * consumption.paneer_count);
    const milkTotal = roundUpCurrency(consumption.milk_amount);
    const absentDays = Math.max(0, Math.min(getDaysInMonth(expense.month), Number(consumption.absent_days || 0)));
    const absenceDeduction = calculateAbsenceDeduction({
      absentDays,
      daysInMonth,
      perDayMessBill: derivedMessBillPerDay,
      monthlyMessBill: baseMessMonthly,
    });
    const billableDays = absentDays >= 10 ? Math.max(daysInMonth - absentDays, 0) : daysInMonth;
    const baseMessCharge = roundUpCurrency(Math.max(baseMessMonthly - absenceDeduction, 0));

    // Total amount
    const totalAmount = roundUpCurrency(
      baseMessCharge
        + kebCharge
        + labourChargePerStudent
        + nightWatchCharge
        + bakeryChargePerStudent
        + totalDynamicCharges
        + eggTotal
        + chickenTotal
        + paneerTotal
        + milkTotal
    );

    // Due date and fine
    const resolvedDueDate = dueDate ? new Date(dueDate) : calculateDueDate(expense.month);
    const manualFine = roundUpCurrency(consumption.fine_amount);
    const isEblStudent = Boolean(student.isEBL);
    const fine = isEblStudent && eblExemptFine ? 0 : manualFine;

    // Construct bill payload
    return {
      studentId: student._id,
      userId: student.userId._id,
      hostelId: expense.hostelId,
      month: expense.month,
      is_ebl_student: isEblStudent,
      ebl_category: student.eblCategory || "",

      // Charges
      base_mess: baseMessCharge,
      keb_charge: kebCharge,
      labour_charge: labourChargePerStudent,
      night_watch_charge: nightWatchCharge,
      bakery_charge: bakeryChargePerStudent,
      additional_charge: totalDynamicCharges,
      dynamic_charge_items: dynamicChargeItems,

      // Unit items
      egg_count: consumption.egg_count,
      egg_total: eggTotal,
      chicken_count: consumption.chicken_count,
      chicken_total: chickenTotal,
      paneer_count: consumption.paneer_count,
      paneer_total: paneerTotal,
      milk_amount: consumption.milk_amount,
      milk_total: milkTotal,
      absent_days: absentDays,
      billable_days: billableDays,
      absence_deduction: absenceDeduction,

      // Final
      total_amount: totalAmount,
      fine,
      manual_fine: fine,
      due_date: resolvedDueDate,
      announcement_date: announcementDate ? new Date(announcementDate) : null,
      student_payment_mode: "",
      student_payment_made_date: null,
      student_utr_number: "",
      payment_status: isEblStudent ? "ebl" : "pending",
      amount_paid: 0,
    };
  });

  return bills;
};

module.exports = {
  generateMessBills,
  calculateDueDate,
  calculateFine,
  calculateAbsenceDeduction,
  roundTwoDecimals,
};
