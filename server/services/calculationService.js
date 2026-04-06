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
const roundTwoDecimals = (value) => {
  return Math.round(value * 100) / 100;
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
 * @param {boolean} isEBL – whether student is EBL (Electricity Bill Liable)
 * @param {boolean} eblExemptFine – if true, EBL students get fine = 0 (default: true)
 * @returns {number} – fine amount
 */
const calculateFine = (dueDate, currentDate = new Date(), isEBL = false, eblExemptFine = true) => {
  // EBL students exempt from fine (configurable)
  if (isEBL && eblExemptFine) {
    return 0;
  }

  // Calculate days late
  const daysLate = Math.floor((currentDate - dueDate) / (1000 * 60 * 60 * 24));

  if (daysLate <= 0) {
    // Bill not yet due
    return 0;
  }

  if (daysLate <= 30) {
    return daysLate * 2;
  }

  // More than 30 days late: escalated fine
  return (30 * 2) + ((daysLate - 30) * 5);
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
  const { eblExemptFine = true, currentDate = new Date(), charges = [] } = options;

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
    };
  });

  // ─── 4. Calculate per-unit charges ─────────────────────────────────────────────
  // Base mess
  const baseMeasTotal = expense.elp + expense.cylinder + expense.oil + expense.kirana + expense.milk;
  const baseMessPerStudent = roundTwoDecimals(baseMeasTotal / totalActiveStudents);

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
  const labourChargePerStudent = roundTwoDecimals(expense.labour_total / totalActiveStudents);

  // Night watch (girls only)
  const nightWatchChargePerStudent = totalGirls > 0 ? roundTwoDecimals(expense.night_watch_total / totalGirls) : 0;

  // Bakery + Banana
  const bakeryBananaTotalAmount = expense.bakery_total + expense.banana_total;
  const bakeryChargePerStudent = roundTwoDecimals(bakeryBananaTotalAmount / totalActiveStudents);

  // Dynamic charges
  const totalDynamicCharges = charges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0);
  const additionalChargePerStudent =
    totalActiveStudents > 0 ? roundTwoDecimals(totalDynamicCharges / totalActiveStudents) : 0;

  // ─── 5. Generate bill for each active student ──────────────────────────────────
  const bills = activeStudents.map((student) => {
    const studentIdStr = student._id.toString();
    const consumption = consumptionMap[studentIdStr] || { egg_count: 0, chicken_count: 0, paneer_count: 0 };

    // Determine KEB charge based on student gender
    const kebCharge = student.gender === "female" ? kebGirlsPerStudent : kebBoysPerStudent;

    // Night watch only for girls
    const nightWatchCharge = student.gender === "female" ? nightWatchChargePerStudent : 0;

    // Unit item totals
    const eggTotal = roundTwoDecimals(expense.egg_price * consumption.egg_count);
    const chickenTotal = roundTwoDecimals(expense.chicken_price * consumption.chicken_count);
    const paneerTotal = roundTwoDecimals(expense.paneer_price * consumption.paneer_count);

    // Total amount
    const totalAmount = roundTwoDecimals(
      baseMessPerStudent
        + kebCharge
        + labourChargePerStudent
        + nightWatchCharge
        + bakeryChargePerStudent
        + additionalChargePerStudent
        + eggTotal
        + chickenTotal
        + paneerTotal
    );

    // Due date and fine
    const dueDate = calculateDueDate(expense.month);
    const fine = roundTwoDecimals(calculateFine(dueDate, currentDate, student.isEBL, eblExemptFine));

    // Construct bill payload
    return {
      studentId: student._id,
      userId: student.userId._id,
      hostelId: expense.hostelId,
      month: expense.month,

      // Charges
      base_mess: baseMessPerStudent,
      keb_charge: kebCharge,
      labour_charge: labourChargePerStudent,
      night_watch_charge: nightWatchCharge,
      bakery_charge: bakeryChargePerStudent,
      additional_charge: additionalChargePerStudent,

      // Unit items
      egg_count: consumption.egg_count,
      egg_total: eggTotal,
      chicken_count: consumption.chicken_count,
      chicken_total: chickenTotal,
      paneer_count: consumption.paneer_count,
      paneer_total: paneerTotal,

      // Final
      total_amount: totalAmount,
      fine,
      due_date: dueDate,
      payment_status: "pending",
    };
  });

  return bills;
};

module.exports = {
  generateMessBills,
  calculateDueDate,
  calculateFine,
  roundTwoDecimals,
};
