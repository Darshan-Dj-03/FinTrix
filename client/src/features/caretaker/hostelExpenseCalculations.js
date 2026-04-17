const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
};

const roundCurrency = (value = 0) => Number(toNumber(value).toFixed(2));

export const blankHostelExpenseBill = () => ({
  store_name: "",
  bill_number: "",
  description: "",
  bill_amount: "",
});

export const hostelExpenseBreakdownLabels = {
  elp: "ELP",
  chicken: "Chicken",
  cylinder: "Cylinder",
  keb_total: "KEB Total",
  oil: "Oil",
  kirani: "Kirani",
  milk: "Milk",
  labour_bill: "Labour Bill",
  labour_night_watch: "Labour Night Watch",
  hostel_fund: "Hostel Fund",
  milling: "Milling",
  veg: "Veg",
  banana: "Banana",
  bakery: "Bakery",
  egg_total: "Egg Total",
  chicken_total_misc: "Chicken Total Misc",
  paneer_total: "Paneer Total",
};

export const hostelExpenseBreakdownFieldKeys = Object.keys(hostelExpenseBreakdownLabels);

export const sumBreakdownItems = (items = []) =>
  roundCurrency(items.reduce((sum, item) => sum + toNumber(item.bill_amount), 0));

export const normalizeBillBreakdownsForForm = (record = {}) =>
  hostelExpenseBreakdownFieldKeys.reduce((acc, key) => {
    const matchingBreakdown = Array.isArray(record.bill_breakdowns)
      ? record.bill_breakdowns.find((entry) => entry?.key === key)
      : null;

    if (matchingBreakdown?.items?.length) {
      acc[key] = matchingBreakdown.items.map((item) => ({
        store_name: item.store_name || "",
        bill_number: item.bill_number || "",
        description: item.description || "",
        bill_amount: item.bill_amount ?? "",
      }));
      return acc;
    }

    if (toNumber(record[key]) > 0) {
      acc[key] = [
        {
          store_name: "Legacy Entry",
          bill_number: "-",
          description: "Imported existing total",
          bill_amount: record[key],
        },
      ];
      return acc;
    }

    acc[key] = [blankHostelExpenseBill()];
    return acc;
  }, {});

export const serializeBillBreakdownsForPayload = (billBreakdowns = {}) =>
  hostelExpenseBreakdownFieldKeys
    .map((key) => ({
      key,
      items: Array.isArray(billBreakdowns[key])
        ? billBreakdowns[key]
            .map((item) => ({
              store_name: String(item?.store_name || "").trim(),
              bill_number: String(item?.bill_number || "").trim(),
              description: String(item?.description || "").trim(),
              bill_amount: toNumber(item?.bill_amount),
            }))
            .filter(
              (item) =>
                item.store_name ||
                item.bill_number ||
                item.description ||
                item.bill_amount > 0
            )
        : [],
    }))
    .filter((entry) => entry.items.length > 0);

const safeDivide = (total, count) => {
  const numericCount = toNumber(count);
  if (numericCount <= 0) return 0;
  return roundCurrency(toNumber(total) / numericCount);
};

export function calculateHostelExpense(values = {}) {
  const total_students = toNumber(values.total_students);
  const total_girls = toNumber(values.total_girls);
  const total_boys = toNumber(values.total_boys);
  const egg_students_count = toNumber(values.egg_students_count);
  const chicken_students_count = toNumber(values.chicken_students_count);
  const paneer_students_count = toNumber(values.paneer_students_count);

  const keb_total = toNumber(values.keb_total);
  const labour_bill = toNumber(values.labour_bill);
  const labour_night_watch = toNumber(values.labour_night_watch);
  const banana = toNumber(values.banana);
  const bakery = toNumber(values.bakery);
  const egg_total = toNumber(values.egg_total);
  const chicken_total_misc = toNumber(values.chicken_total_misc);
  const paneer_total = toNumber(values.paneer_total);

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
    keb_girls,
    keb_boys,
    keb_per_girl,
    keb_per_boy,
    labour_per_student,
    labour_night_watch_per_girl,
    misc_per_student,
    egg_price_per_3,
    chicken_price_per_3,
    paneer_price_per_3,
    egg_price_per_unit: safeDivide(egg_price_per_3, 3),
    chicken_price_per_unit: safeDivide(chicken_price_per_3, 3),
    paneer_price_per_unit: safeDivide(paneer_price_per_3, 3),
  };
}

export const hostelExpenseDefaultValues = {
  month: "",
  elp: 0,
  chicken: 0,
  cylinder: 0,
  keb_total: 0,
  oil: 0,
  kirani: 0,
  milk: 0,
  labour_bill: 0,
  labour_night_watch: 0,
  hostel_fund: 0,
  milling: 0,
  veg: 0,
  banana: 0,
  bakery: 0,
  egg_total: 0,
  chicken_total_misc: 0,
  paneer_total: 0,
  total_students: 0,
  total_girls: 0,
  total_boys: 0,
  egg_students_count: 0,
  chicken_students_count: 0,
  paneer_students_count: 0,
};

export const editableNumericFields = Object.keys(hostelExpenseDefaultValues).filter(
  (field) => field !== "month"
);
