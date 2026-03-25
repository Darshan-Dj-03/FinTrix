// Load environment variables first – must be before any other imports
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes    = require("./routes/authRoutes");
const adminRoutes   = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");
const hostelRoutes  = require("./routes/hostelRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const billRoutes    = require("./routes/billRoutes");

// ─── App Initialisation ───────────────────────────────────────────────────────
const app = express();

// ─── Database Connection ──────────────────────────────────────────────────────
connectDB();

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(express.json());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Routes ─────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/student", studentRoutes);
app.use("/hostel", hostelRoutes);
app.use("/expense", expenseRoutes);
app.use("/bill", billRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Fintrix API is running.",
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error.",
  });
});

// ─── Server Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

// ⚡ Start server only if NOT running tests
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Fintrix server running on http://${HOST}:${PORT}`);
  });
}
