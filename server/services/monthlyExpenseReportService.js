const HostelExpense = require("../models/HostelExpense");
const MonthlyExpenseReport = require("../models/MonthlyExpenseReport");
const GuestCharge = require("../models/GuestCharge");

const MONTH_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const roundCurrency = (value = 0) => Number((Number(value || 0)).toFixed(2));

const parseMonth = (month) => {
  if (!MONTH_REGEX.test(month)) {
    const error = new Error('month must be in "Mon-YYYY" format (e.g. Jan-2026).');
    error.status = 400;
    throw error;
  }

  const [monthLabel, year] = month.split("-");
  return {
    monthLabel,
    monthIndex: MONTHS.indexOf(monthLabel),
    year: Number(year),
  };
};

const getPreviousMonth = (month) => {
  const { monthIndex, year } = parseMonth(month);
  if (monthIndex === 0) {
    return `Dec-${year - 1}`;
  }

  return `${MONTHS[monthIndex - 1]}-${year}`;
};

const getDaysInMonth = (month) => {
  const { monthIndex, year } = parseMonth(month);
  return new Date(year, monthIndex + 1, 0).getDate();
};

const buildReportSource = async (hostelId, month) => {
  const hostelExpense = await HostelExpense.findOne({ hostelId, month }).populate("hostelId", "name type location");

  if (!hostelExpense) {
    const error = new Error("Hostel expense record not found for this month.");
    error.status = 404;
    throw error;
  }

  const previousMonth = getPreviousMonth(month);
  const daysInMonth = getDaysInMonth(month);
  const guestCharges = await GuestCharge.find({ hostelId, month }).sort({ event_start_date: 1, createdAt: 1 });

  const msc_breakdown = {
    kirani: roundCurrency(hostelExpense.kirani || 0),
    oil: roundCurrency(hostelExpense.oil || 0),
    milling: roundCurrency(hostelExpense.milling || 0),
    veg: roundCurrency(hostelExpense.veg || 0),
    milk: roundCurrency(hostelExpense.milk || 0),
    cylinder: roundCurrency(hostelExpense.cylinder || 0),
    elp: roundCurrency(hostelExpense.elp || 0),
  };

  const msc_total = roundCurrency(
    Object.values(msc_breakdown).reduce((sum, value) => sum + Number(value || 0), 0)
  );

  const other_misc_breakdown = {
    chicken_total_misc: roundCurrency(hostelExpense.chicken_total_misc || 0),
    paneer_total: roundCurrency(hostelExpense.paneer_total || 0),
    egg_total: roundCurrency(hostelExpense.egg_total || 0),
    banana: roundCurrency(hostelExpense.banana || 0),
    bakery: roundCurrency(hostelExpense.bakery || 0),
  };

  const other_misc = roundCurrency(
    Object.values(other_misc_breakdown).reduce((sum, value) => sum + Number(value || 0), 0)
  );
  const guest_charge_breakdown = guestCharges.map((charge) => ({
    id: charge._id,
    event_name: charge.event_name,
    guest_count: Number(charge.guest_count || 0),
    amount: roundCurrency(charge.amount || 0),
    event_start_date: charge.event_start_date,
    event_end_date: charge.event_end_date,
  }));
  const guest_charge_total = roundCurrency(
    guest_charge_breakdown.reduce((sum, charge) => sum + Number(charge.amount || 0), 0)
  );

  const electricity_bill = roundCurrency(hostelExpense.keb_total || 0);
  const internet = roundCurrency(hostelExpense.elp || 0);
  const labour_payment = roundCurrency(
    Number(hostelExpense.labour_bill || 0) + Number(hostelExpense.labour_night_watch || 0)
  );
  const total_students = Number(hostelExpense.total_students || 0);
  const total_boys = Number(hostelExpense.total_boys || 0);
  const total_girls = Number(hostelExpense.total_girls || 0);
  const total_days = total_students * daysInMonth;

  return {
    hostelExpense,
    previousMonth,
    hostelId,
    month,
    daysInMonth,
    msc_breakdown,
    msc_total,
    other_misc_breakdown,
    other_misc,
    guest_charge_breakdown,
    guest_charge_total,
    electricity_bill,
    internet,
    labour_payment,
    total_students,
    total_boys,
    total_girls,
    total_days,
  };
};

const calculateMonthlyExpenseReport = ({ source, opening_balance = 0, manual_closing_balance = 0 }) => {
  const resolvedClosingBalance = Number(manual_closing_balance || 0);
  const total_closing_balance = roundCurrency(source.msc_total + resolvedClosingBalance);
  const total_opening_balance = roundCurrency(total_closing_balance - Number(opening_balance || 0));
  const total_expenditure = roundCurrency(total_opening_balance - Number(source.guest_charge_total || 0));
  const mess_bill_per_day =
    source.total_days > 0 ? roundCurrency(total_expenditure / source.total_days) : 0;

  return {
    msc_total: source.msc_total,
    closing_balance_last_month: roundCurrency(resolvedClosingBalance),
    total_closing_balance,
    opening_balance: roundCurrency(opening_balance),
    total_opening_balance,
    guest_charges: roundCurrency(source.guest_charge_total || 0),
    total_expenditure,
    total_days: source.total_days,
    mess_bill_per_day,
    electricity_bill: source.electricity_bill,
    internet: source.internet,
    labour_payment: source.labour_payment,
    other_misc: source.other_misc,
    total_students: source.total_students,
    total_boys: source.total_boys,
    total_girls: source.total_girls,
    closing_balance_source_month: null,
    opening_balance_manual: true,
  };
};

module.exports = {
  buildReportSource,
  calculateMonthlyExpenseReport,
  getPreviousMonth,
  getDaysInMonth,
  roundCurrency,
};
