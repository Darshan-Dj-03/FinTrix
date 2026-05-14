const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_FINE_RATE = 2;
const SECOND_FINE_RATE = 5;
const DEFAULT_UTR_MESSAGE = "UTR not updated by student";

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const roundUpCurrency = (value = 0) => Math.ceil(Math.max(toNumber(value), 0));
const roundTwoDecimals = (value = 0) => Math.round(Math.max(toNumber(value), 0) * 100) / 100;

const calculateDynamicFine = (dueDate, currentDate = new Date()) => {
  if (!dueDate) {
    return 0;
  }

  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const daysLate = Math.floor((today.getTime() - due.getTime()) / ONE_DAY_MS);
  if (daysLate <= 0) {
    return 0;
  }

  if (daysLate <= 30) {
    return roundUpCurrency(daysLate * FIRST_FINE_RATE);
  }

  return roundUpCurrency((30 * FIRST_FINE_RATE) + ((daysLate - 30) * SECOND_FINE_RATE));
};

const getAbsenceImpact = (bill) => {
  const absentDays = Math.max(0, toNumber(bill?.absent_days));
  const billableDays = Math.max(0, toNumber(bill?.billable_days));
  const baseMess = Math.max(0, toNumber(bill?.base_mess));
  const storedDeduction = Math.max(0, toNumber(bill?.absence_deduction));

  if (storedDeduction > 0 || absentDays === 0) {
    return {
      absent_days: absentDays,
      billable_days: billableDays,
      absence_deduction: roundUpCurrency(storedDeduction),
      base_mess_before_absence: roundUpCurrency(baseMess + storedDeduction),
    };
  }

  let inferredDeduction = 0;

  if (absentDays <= 4) {
    inferredDeduction = 0;
  } else if (absentDays <= 9) {
    inferredDeduction = absentDays * 10;
  } else if (billableDays > 0) {
    inferredDeduction = (baseMess / billableDays) * absentDays;
  }

  return {
    absent_days: absentDays,
    billable_days: billableDays,
    absence_deduction: roundUpCurrency(inferredDeduction),
    base_mess_before_absence: roundUpCurrency(baseMess + inferredDeduction),
  };
};

const applyLiveBillState = (bill, currentDate = new Date()) => {
  if (!bill) {
    return bill;
  }

  const totalAmount = roundUpCurrency(bill.total_amount || 0);
  const amountPaid = roundUpCurrency(bill.amount_paid || 0);
  const isEblStudent = Boolean(bill.is_ebl_student);
  const absenceImpact = getAbsenceImpact(bill);
  if (isEblStudent) {
    const claimedAmount = roundUpCurrency(
      bill.ebl_claimed_amount !== undefined ? bill.ebl_claimed_amount : bill.amount_paid || 0
    );
    const differenceAmount = roundUpCurrency(
      bill.ebl_difference_amount !== undefined
        ? bill.ebl_difference_amount
        : Math.max(totalAmount - claimedAmount, 0)
    );
    const studentPaidAmount = roundUpCurrency(bill.ebl_student_paid_amount || 0);
    const remainingBalance = Math.max(
      roundUpCurrency(
        bill.ebl_remaining_balance !== undefined
          ? bill.ebl_remaining_balance
          : differenceAmount - studentPaidAmount
      ),
      0
    );
    const hasUniversityClaim = claimedAmount > 0;
    const hasScholarshipOffset =
      differenceAmount < totalAmount ||
      bill.payment_status === "partial_scholarship_received" ||
      bill.payment_status === "partial_university_claim_received" ||
      hasUniversityClaim;
    const manualFine = 0;
    const liveFine = 0;
    const totalPayable = remainingBalance;
    const paymentStatus =
      remainingBalance <= 0
        ? "paid"
        : hasUniversityClaim
          ? "partial_university_claim_received"
          : hasScholarshipOffset
            ? "partial_scholarship_received"
            : "ebl";

    if (typeof bill.toObject === "function") {
      const plain = bill.toObject();
      return {
        ...plain,
        total_amount: totalAmount,
        fine: liveFine,
        manual_fine: manualFine,
        late_fine: 0,
        amount_paid: roundUpCurrency(claimedAmount + studentPaidAmount),
        payment_status: paymentStatus,
        total_payable: totalPayable,
        outstanding_amount: remainingBalance,
        ebl_claimed_amount: claimedAmount,
        ebl_difference_amount: differenceAmount,
        ebl_student_paid_amount: studentPaidAmount,
        ebl_remaining_balance: remainingBalance,
        student_utr_number: plain.student_utr_number || "",
        ...absenceImpact,
      };
    }

    return {
      ...bill,
      total_amount: totalAmount,
      fine: liveFine,
      manual_fine: manualFine,
      late_fine: 0,
      amount_paid: roundUpCurrency(claimedAmount + studentPaidAmount),
      payment_status: paymentStatus,
      total_payable: totalPayable,
      outstanding_amount: remainingBalance,
      ebl_claimed_amount: claimedAmount,
      ebl_difference_amount: differenceAmount,
      ebl_student_paid_amount: studentPaidAmount,
      ebl_remaining_balance: remainingBalance,
      student_utr_number: bill.student_utr_number || "",
      ...absenceImpact,
    };
  }

  const storedFine = roundUpCurrency(bill.fine || 0);
  const currentLateFine = calculateDynamicFine(bill.due_date, currentDate);
  const wasMarkedPaid =
    bill.payment_status === "paid" || amountPaid >= totalAmount + storedFine;
  const hasManualFine = bill.manual_fine !== undefined && bill.manual_fine !== null;
  const shouldInferLegacyManualFine =
    !wasMarkedPaid &&
    roundUpCurrency(hasManualFine ? bill.manual_fine : 0) === 0 &&
    storedFine > currentLateFine;
  const manualFine = roundUpCurrency(
    shouldInferLegacyManualFine
      ? storedFine - currentLateFine
      : hasManualFine
        ? bill.manual_fine
        : bill.payment_status === "paid"
          ? storedFine
          : Math.max(storedFine - currentLateFine, 0)
  );
  const lateFine = wasMarkedPaid ? Math.max(storedFine - manualFine, 0) : currentLateFine;
  const liveFine = wasMarkedPaid ? storedFine : roundUpCurrency(manualFine + lateFine);
  const totalPayable = totalAmount + liveFine;
  const outstanding = wasMarkedPaid ? 0 : Math.max(totalPayable - amountPaid, 0);

  const currentStatus =
    wasMarkedPaid ? "paid" : outstanding <= 0 ? "paid" : amountPaid > 0 ? "partial" : bill.payment_status || "pending";

  if (typeof bill.toObject === "function") {
    const plain = bill.toObject();
    return {
      ...plain,
      total_amount: totalAmount,
      fine: liveFine,
      manual_fine: manualFine,
      late_fine: lateFine,
      amount_paid: amountPaid,
        payment_status: currentStatus,
        total_payable: totalPayable,
        outstanding_amount: outstanding,
        student_utr_number: plain.student_utr_number || "",
        ...absenceImpact,
      };
  }

  return {
    ...bill,
    total_amount: totalAmount,
    fine: liveFine,
    manual_fine: manualFine,
    late_fine: lateFine,
    amount_paid: amountPaid,
    payment_status: currentStatus,
    total_payable: totalPayable,
    outstanding_amount: outstanding,
    student_utr_number: bill.student_utr_number || "",
    ...absenceImpact,
  };
};

module.exports = {
  DEFAULT_UTR_MESSAGE,
  FIRST_FINE_RATE,
  SECOND_FINE_RATE,
  roundUpCurrency,
  roundTwoDecimals,
  calculateDynamicFine,
  getAbsenceImpact,
  applyLiveBillState,
};
