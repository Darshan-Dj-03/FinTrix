const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../utils/logger");

/**
 * protect – verifies the Bearer JWT in the Authorization header.
 *
 * On success: attaches the full user document (minus password) to req.user
 *             and calls next().
 * On failure: returns 401 Unauthorized.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from "Authorization: Bearer <token>" header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Access denied. No token provided." });
    }

    // Verify signature and expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB to ensure account still exists / not deleted
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User belonging to this token no longer exists." });
    }

    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "This account is inactive. Please contact an administrator.",
      });
    }

    req.user = user; // Attach user to request object
    next();
  } catch (error) {
    logger.warn("Authentication failed", {
      path: req.originalUrl,
      error: error.message,
    });

    // Handle specific JWT errors with clear messages
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid token." });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token has expired. Please log in again." });
    }
    return res.status(500).json({ success: false, message: "Server error during authentication." });
  }
};

module.exports = { protect };
