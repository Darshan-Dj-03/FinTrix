const getPagination = (query = {}) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 500);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const buildPaginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: total ? Math.ceil(total / limit) : 0,
});

module.exports = {
  getPagination,
  buildPaginationMeta,
};
