const mongoose = require("mongoose");

/**
 * Connects to MongoDB Atlas using the MONGO_URI environment variable.
 * Exits the process if the connection fails to prevent the server from
 * running in a broken state.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // useNewUrlParser and useUnifiedTopology are defaults in mongoose 8+
    });
    console.log(` MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(` MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit with failure
  }
};

module.exports = connectDB;
