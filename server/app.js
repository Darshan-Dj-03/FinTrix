require("./config/env");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");
const hostelRoutes = require("./routes/hostelRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const hostelExpenseRoutes = require("./routes/hostelExpenseRoutes");
const consumptionRoutes = require("./routes/consumptionRoutes");
const billRoutes = require("./routes/billRoutes");
const reportRoutes = require("./routes/reportRoutes");
const monthlyExpenseReportRoutes = require("./routes/monthlyExpenseReportRoutes");
const eblRoutes = require("./routes/eblRoutes");
const chargeRoutes = require("./routes/chargeRoutes");
const guestChargeRoutes = require("./routes/guestChargeRoutes");
const advanceRoutes = require("./routes/advanceRoutes");
const ledgerRoutes = require("./routes/ledgerRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const sanitizeRequest = require("./middleware/sanitizeMiddleware");
const requestLogger = require("./middleware/requestLogger");
const { globalErrorHandler } = require("./middleware/validationMiddleware");
const registerSwagger = require("./docs/swagger");

const app = express();
const configuredCorsOrigin = String(process.env.CORS_ORIGIN || "*").trim();
const allowedOrigins =
  configuredCorsOrigin === "*" || !configuredCorsOrigin
    ? ["*"]
    : configuredCorsOrigin
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

const corsOptions = {
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key"],
};

if (allowedOrigins.includes("*")) {
  corsOptions.origin = "*";
} else {
  corsOptions.origin = (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("CORS origin not allowed."));
  };
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));
app.use(sanitizeRequest);
app.use(requestLogger);

app.get("/health", (req, res) => {
  const dbStateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return res.status(200).json({
    success: true,
    message: "Fintrix API is healthy.",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: dbStateMap[mongoose.connection.readyState] || "unknown",
    },
  });
});

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/student", studentRoutes);
app.use("/hostel", hostelRoutes);
app.use("/expense", expenseRoutes);
app.use("/hostel-expense", hostelExpenseRoutes);
app.use("/consumption", consumptionRoutes);
app.use("/bill", billRoutes);
app.use("/report", reportRoutes);
app.use("/monthly-expense-report", monthlyExpenseReportRoutes);
app.use("/ebl", eblRoutes);
app.use("/charges", chargeRoutes);
app.use("/guest-charge", guestChargeRoutes);
app.use("/advances", advanceRoutes);
app.use("/ledger", ledgerRoutes);
app.use("/payment", paymentRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/notifications", notificationRoutes);

if (process.env.SWAGGER_ENABLED !== "false") {
  registerSwagger(app);
}

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

app.use(globalErrorHandler);

module.exports = app;
