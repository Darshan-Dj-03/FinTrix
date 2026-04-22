const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_FINE_RATE = 2;
const SECOND_FINE_RATE = 5;
const DEFAULT_UTR_MESSAGE = "UTR not updated by student";

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const roundUpCurrency = (value = 0) => Math.ceil(Math.max(toNumber(value), 0));

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

const applyLiveBillState = (bill, currentDate = new Date()) => {
  if (!bill) {
    return bill;
  }

  const totalAmount = roundUpCurrency(bill.total_amount || 0);
  const amountPaid = roundUpCurrency(bill.amount_paid || 0);
  const isEblStudent = Boolean(bill.is_ebl_student);
  if (isEblStudent) {
    const hasClaimSettlement =
      bill.payment_status === "paid" || (Boolean(String(bill.student_utr_number || "").trim()) && amountPaid > 0);
    const manualFine = 0;
    const liveFine = 0;
    const totalPayable = 0;

    if (typeof bill.toObject === "function") {
      const plain = bill.toObject();
      return {
        ...plain,
        total_amount: totalAmount,
        fine: liveFine,
        manual_fine: manualFine,
        late_fine: 0,
        amount_paid: amountPaid,
        payment_status: hasClaimSettlement ? "paid" : "ebl",
        total_payable: totalPayable,
        outstanding_amount: 0,
        student_utr_number: plain.student_utr_number || "",
      };
    }

    return {
      ...bill,
      total_amount: totalAmount,
      fine: liveFine,
      manual_fine: manualFine,
      late_fine: 0,
      amount_paid: amountPaid,
      payment_status: hasClaimSettlement ? "paid" : "ebl",
      total_payable: totalPayable,
      outstanding_amount: 0,
      student_utr_number: bill.student_utr_number || "",
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
  };
};

module.exports = {
  DEFAULT_UTR_MESSAGE,
  FIRST_FINE_RATE,
  SECOND_FINE_RATE,
  roundUpCurrency,
  calculateDynamicFine,
  applyLiveBillState,
};
