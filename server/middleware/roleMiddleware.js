/**
 * checkRole – role-based access control (RBAC) middleware factory.
 *
 * Usage (in routes):
 *   router.get("/some-route", protect, checkRole("admin"), controller);
 *   router.get("/another",    protect, checkRole("admin", "caretaker"), controller);
 *
 * Must be used AFTER the `protect` middleware so that req.user is populated.
 *
 * @param {...string} allowedRoles - One or more roles that may access the route.
 * @returns Express middleware function.
 */
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user is set by the protect middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(", ")}. Your role: ${req.user.role}.`,
      });
    }

    next();
  };
};

module.exports = { checkRole };
