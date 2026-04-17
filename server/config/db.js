const mongoose = require("mongoose");
const logger = require("../utils/logger");

/**
 * Connects to MongoDB Atlas using the MONGO_URI environment variable.
 * Exits the process if the connection fails to prevent the server from
 * running in a broken state.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    logger.info("MongoDB connected", { host: conn.connection.host });
  } catch (error) {
    logger.error("MongoDB connection failed", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

module.exports = connectDB;
