const sanitizeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((accumulator, [key, nestedValue]) => {
      const sanitizedKey = key.replace(/\$/g, "").replace(/\./g, "");
      accumulator[sanitizedKey] = sanitizeValue(nestedValue);
      return accumulator;
    }, {});
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
};

const sanitizeRequest = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  next();
};

module.exports = sanitizeRequest;
