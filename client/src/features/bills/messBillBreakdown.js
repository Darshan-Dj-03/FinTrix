export const getFoodChargeTotal = (bill = {}) =>
  Number(bill.egg_total || 0) +
  Number(bill.bakery_charge || 0) +
  Number(bill.paneer_total || 0) +
  Number(bill.milk_total || 0) +
  Number(bill.chicken_total || 0);

export const getEstablishmentChargeTotal = (bill = {}) =>
  Number(bill.labour_charge || 0) +
  Number(bill.night_watch_charge || 0) +
  Number(bill.keb_charge || 0);

export const getGrandTotal = (bill = {}) => Number(bill.total_amount || 0) + Number(bill.fine || 0);

export const getDynamicChargeItems = (bill = {}) =>
  Array.isArray(bill.dynamic_charge_items) ? bill.dynamic_charge_items : [];

export const getDynamicChargeTotal = (bill = {}) =>
  getDynamicChargeItems(bill).reduce((sum, item) => sum + Number(item.amount || 0), 0) ||
  Number(bill.additional_charge || 0);
