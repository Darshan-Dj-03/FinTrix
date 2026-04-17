export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const ROLE_LABELS = {
  student: "Student",
  caretaker: "Caretaker",
  admin: "Admin",
  dean: "Dean",
  warden: "Warden",
};

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatMonthOption = (date) => `${MONTH_LABELS[date.getMonth()]}-${date.getFullYear()}`;

export const buildMonthValue = (monthIndex, year) => `${MONTH_LABELS[monthIndex]}-${year}`;

export const parseMonthValue = (value) => {
  const [monthLabel, yearValue] = String(value || "").split("-");
  const monthIndex = MONTH_LABELS.indexOf(monthLabel);
  const year = Number(yearValue);

  if (monthIndex === -1 || Number.isNaN(year)) {
    const currentDate = new Date();
    return { monthIndex: currentDate.getMonth(), year: currentDate.getFullYear() };
  }

  return { monthIndex, year };
};

const createMonthOptions = () => {
  const now = new Date();
  const options = [];
  const pastMonths = 24;
  const futureMonths = 24;

  for (let offset = futureMonths; offset >= -pastMonths; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    options.push(formatMonthOption(date));
  }

  return options;
};

export const CURRENT_MONTH = formatMonthOption(new Date());
export const MONTH_OPTIONS = createMonthOptions();
