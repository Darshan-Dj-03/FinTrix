const getAcademicYearStart = (date = new Date()) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 6 ? year : year - 1;
};

export const formatAcademicYear = (startYear) => `${startYear}-${startYear + 1}`;

export const getAcademicYearOptions = ({ past = 2, future = 3 } = {}) => {
  const currentStartYear = getAcademicYearStart();
  const options = [];

  for (let year = currentStartYear - past; year <= currentStartYear + future; year += 1) {
    options.push(formatAcademicYear(year));
  }

  return options;
};

export const getDefaultAcademicYear = () => formatAcademicYear(getAcademicYearStart());
