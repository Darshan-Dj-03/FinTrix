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

const MONTH_NAMES = Object.keys(MONTH_INDEX);

const parseMonthValue = (value) => {
  const [monthLabel, yearLabel] = String(value || "").split("-");
  const monthIndex = MONTH_INDEX[monthLabel];
  const year = Number.parseInt(yearLabel, 10);

  if (monthIndex === undefined || Number.isNaN(year)) {
    return null;
  }

  return { monthLabel, monthIndex, year };
};

const monthToSortable = (value) => {
  const parsed = parseMonthValue(value);
  if (!parsed) {
    return Number.NaN;
  }

  return parsed.year * 12 + parsed.monthIndex;
};

const enumerateMonthsInRange = (fromMonth, toMonth) => {
  const from = parseMonthValue(fromMonth);
  const to = parseMonthValue(toMonth);

  if (!from || !to) {
    return [];
  }

  const start = new Date(from.year, from.monthIndex, 1);
  const end = new Date(to.year, to.monthIndex, 1);

  if (start > end) {
    return [];
  }

  const months = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    months.push(`${MONTH_NAMES[cursor.getMonth()]}-${cursor.getFullYear()}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

module.exports = {
  MONTH_INDEX,
  MONTH_NAMES,
  parseMonthValue,
  monthToSortable,
  enumerateMonthsInRange,
};
