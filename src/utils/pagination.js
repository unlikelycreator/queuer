// Parses page/limit query params and returns { page, limit, skip } plus a
// buildResult(items, total) helper that shapes the standard paginated response.
function getPagination(query, defaultLimit = 12, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    buildResult(items, total) {
      return {
        items,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    },
  };
}

module.exports = { getPagination };
