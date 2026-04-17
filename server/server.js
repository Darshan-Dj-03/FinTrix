require("./config/env");

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const app = require("./app");
const { scheduleBillGeneration } = require("./jobs/billCron");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

let server;

const startServer = async () => {
  await connectDB();

  if (process.env.NODE_CRON_ENABLED !== "false") {
    scheduleBillGeneration();
  }

  server = app.listen(PORT, HOST, () => {
    logger.info("Fintrix server started", { host: HOST, port: PORT });
  });
};

const shutdown = async (signal) => {
  logger.info("Graceful shutdown initiated", { signal });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await mongoose.connection.close();
  process.exit(0);
};

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    logger.error("Server failed to start", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

module.exports = { startServer };
