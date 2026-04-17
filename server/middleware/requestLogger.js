const logger = require("../utils/logger");

const requestLogger = (req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    logger.info("HTTP request", {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?._id || null,
      role: req.user?.role || null,
      ip: req.ip,
    });
  });

  next();
};

module.exports = requestLogger;
