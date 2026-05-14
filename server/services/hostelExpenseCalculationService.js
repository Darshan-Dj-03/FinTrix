const roundCurrency = (value = 0) => Number((Number(value || 0)).toFixed(2));

const HOSTEL_EXPENSE_BREAKDOWN_FIELDS = [
  "chicken",
  "cylinder",
  "keb_total",
  "oil",
  "kirani",
  "milk",
  "labour_bill",
  "labour_night_watch",
  "hostel_fund",
  "internet",
  "elp",
  "milling",
  "veg",
  "banana",
  "bakery",
  "egg_total",
  "chicken_total_misc",
  "paneer_total",
];

const normalizeBreakdownItem = (item = {}) => ({
  store_name: String(item.store_name || item.storeName || "").trim(),
  bill_number: String(item.bill_number || item.billNumber || "").trim(),
  description: String(item.description || "").trim(),
  bill_amount: roundCurrency(item.bill_amount ?? item.billAmount ?? 0),
});

const getNormalizedBillBreakdowns = (payload = {}) => {
  const rawBreakdowns = Array.isArray(payload.bill_breakdowns)
    ? payload.bill_breakdowns
    : Array.isArray(payload.billBreakdowns)
      ? payload.billBreakdowns
      : [];

  const normalized = HOSTEL_EXPENSE_BREAKDOWN_FIELDS.map((key) => {
    const matchingBreakdown = rawBreakdowns.find((entry) => String(entry?.key || "").trim() === key);
    const items = Array.isArray(matchingBreakdown?.items)
      ? matchingBreakdown.items
          .map((item) => normalizeBreakdownItem(item))
          .filter(
            (item) =>
              item.store_name ||
              item.bill_number ||
              item.description ||
              item.bill_amount > 0
          )
      : [];

    if (!items.length) {
      const legacyTotal = numberField(payload[key]);
      if (legacyTotal > 0) {
        return {
          key,
          items: [
            {
              store_name: "Legacy Entry",
              bill_number: "-",
              description: "Imported existing total",
              bill_amount: roundCurrency(legacyTotal),
            },
          ],
        };
      }
    }

    return { key, items };
  });

  return normalized.filter((entry) => entry.items.length > 0);
};

const getBreakdownTotal = (billBreakdowns = [], key, fallbackValue = 0) => {
  const matchingBreakdown = billBreakdowns.find((entry) => entry.key === key);
  if (matchingBreakdown?.items?.length) {
    return roundCurrency(
      matchingBreakdown.items.reduce((sum, item) => sum + numberField(item.bill_amount), 0)
    );
  }

  return numberField(fallbackValue);
};

const safeDivide = (total, count) => {
  const numericCount = Number(count || 0);
  if (numericCount <= 0) return 0;
  return roundCurrency(Number(total || 0) / numericCount);
};

const numberField = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
};

const calculateHostelExpense = (payload = {}) => {
  const bill_breakdowns = getNormalizedBillBreakdowns(payload);
  const total_students = numberField(payload.total_students);
  const total_girls = numberField(payload.total_girls);
  const total_boys = numberField(payload.total_boys);
  const egg_students_count = numberField(payload.egg_students_count);
  const chicken_students_count = numberField(payload.chicken_students_count);
  const paneer_students_count = numberField(payload.paneer_students_count);

  const keb_total = getBreakdownTotal(bill_breakdowns, "keb_total", payload.keb_total);
  const labour_bill = getBreakdownTotal(bill_breakdowns, "labour_bill", payload.labour_bill);
  const labour_night_watch = getBreakdownTotal(
    bill_breakdowns,
    "labour_night_watch",
    payload.labour_night_watch
  );
  const banana = getBreakdownTotal(bill_breakdowns, "banana", payload.banana);
  const bakery = getBreakdownTotal(bill_breakdowns, "bakery", payload.bakery);
  const egg_total = getBreakdownTotal(bill_breakdowns, "egg_total", payload.egg_total);
  const chicken_total_misc = getBreakdownTotal(
    bill_breakdowns,
    "chicken_total_misc",
    payload.chicken_total_misc
  );
  const paneer_total = getBreakdownTotal(bill_breakdowns, "paneer_total", payload.paneer_total);

  const keb_girls = roundCurrency(keb_total * 0.7);
  const keb_boys = roundCurrency(keb_total * 0.3);
  const keb_per_girl = safeDivide(keb_girls, total_girls);
  const keb_per_boy = safeDivide(keb_boys, total_boys);
  const labour_per_student = safeDivide(labour_bill, total_students);
  const labour_night_watch_per_girl = roundCurrency(
    labour_per_student + safeDivide(labour_night_watch, total_girls)
  );
  const misc_per_student = safeDivide(banana + bakery, total_students);

  const egg_price_per_3 = safeDivide(egg_total, egg_students_count);
  const chicken_price_per_3 = safeDivide(chicken_total_misc, chicken_students_count);
  const paneer_price_per_3 = safeDivide(paneer_total, paneer_students_count);

  return {
    bill_breakdowns,
    chicken: getBreakdownTotal(bill_breakdowns, "chicken", payload.chicken),
    cylinder: getBreakdownTotal(bill_breakdowns, "cylinder", payload.cylinder),
    keb_total,
    keb_girls,
    keb_boys,
    keb_per_girl,
    keb_per_boy,
    oil: getBreakdownTotal(bill_breakdowns, "oil", payload.oil),
    kirani: getBreakdownTotal(bill_breakdowns, "kirani", payload.kirani),
    milk: getBreakdownTotal(bill_breakdowns, "milk", payload.milk),
    labour_bill,
    labour_night_watch,
    labour_per_student,
    labour_night_watch_per_girl,
    hostel_fund: getBreakdownTotal(bill_breakdowns, "hostel_fund", payload.hostel_fund),
    internet: getBreakdownTotal(bill_breakdowns, "internet", payload.internet),
    elp: getBreakdownTotal(bill_breakdowns, "elp", payload.elp),
    milling: getBreakdownTotal(bill_breakdowns, "milling", payload.milling),
    veg: getBreakdownTotal(bill_breakdowns, "veg", payload.veg),
    banana,
    bakery,
    misc_per_student,
    egg_total,
    chicken_total_misc,
    paneer_total,
    egg_price_per_3,
    chicken_price_per_3,
    paneer_price_per_3,
    egg_price_per_unit: safeDivide(egg_price_per_3, 3),
    chicken_price_per_unit: safeDivide(chicken_price_per_3, 3),
    paneer_price_per_unit: safeDivide(paneer_price_per_3, 3),
    total_students,
    total_girls,
    total_boys,
    egg_students_count,
    chicken_students_count,
    paneer_students_count,
  };
};

module.exports = {
  calculateHostelExpense,
  safeDivide,
  roundCurrency,
  HOSTEL_EXPENSE_BREAKDOWN_FIELDS,
  getNormalizedBillBreakdowns,
};
