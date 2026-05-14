const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_FINE_RATE = 2;
const SECOND_FINE_RATE = 5;

const normalizeDate = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

export const getDelayDays = (dueDate, referenceDate) => {
  const due = normalizeDate(dueDate);
  const reference = normalizeDate(referenceDate);

  if (!due || !reference) {
    return 0;
  }

  const diffMs = reference.getTime() - due.getTime();
  return diffMs > 0 ? Math.floor(diffMs / ONE_DAY_MS) : 0;
};

export const calculateLateFinePreview = (dueDate, referenceDate) => {
  const daysLate = getDelayDays(dueDate, referenceDate);

  if (daysLate <= 0) {
    return 0;
  }

  if (daysLate <= 30) {
    return Math.ceil(daysLate * FIRST_FINE_RATE);
  }

  return Math.ceil((30 * FIRST_FINE_RATE) + ((daysLate - 30) * SECOND_FINE_RATE));
};
