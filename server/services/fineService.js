/**
 * Calculate fine based on payment delay
 * Rules:
 * - daysLate <= 30: fine = daysLate * 2
 * - daysLate > 30: fine = (30 * 2) + ((daysLate - 30) * 5)
 * - EBL students get 50% reduction
 */
const calculateFine = (dueDate, isEBL = false, currentDate = new Date()) => {
  const dueDateObj = new Date(dueDate);
  const current = new Date(currentDate);
  
  // Calculate days late
  const daysLate = Math.ceil((current - dueDateObj) / (1000 * 60 * 60 * 24));

  if (daysLate <= 0) {
    return 0; // Bill not yet due
  }

  let fine = 0;

  if (daysLate <= 30) {
    fine = daysLate * 2;
  } else {
    fine = (30 * 2) + ((daysLate - 30) * 5);
  }

  // Apply EBL exemption (50% reduction)
  if (isEBL) {
    fine = fine * 0.5;
  }

  return Math.round(fine * 100) / 100; // Round to 2 decimals
};

/**
 * Calculate total amount including fine
 */
const calculateTotalWithFine = (billAmount, fine) => {
  return Math.round((billAmount + fine) * 100) / 100;
};

/**
 * Get fine status and days late
 */
const getFineStatus = (dueDate, currentDate = new Date()) => {
  const dueDateObj = new Date(dueDate);
  const current = new Date(currentDate);
  
  const daysLate = Math.ceil((current - dueDateObj) / (1000 * 60 * 60 * 24));

  return {
    daysLate: Math.max(0, daysLate),
    isPaid: daysLate <= 0,
    isOverdue: daysLate > 0,
    daysOverdue: Math.max(0, daysLate),
  };
};

module.exports = {
  calculateFine,
  calculateTotalWithFine,
  getFineStatus,
};
