const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * User schema – represents every authenticated user in the system.
 * Admin is inserted manually into the DB; all other users are created by admin.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // Never return password in queries by default
    },

    role: {
      type: String,
      enum: ["admin", "caretaker", "warden", "dean", "student"],
      required: [true, "Role is required"],
    },

    // Links non-admin staff/students to a specific hostel (ObjectId ref)
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      default: null,
    },

    // Forces user to change temp password on first login
    isFirstLogin: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    isEBL: {
      type: Boolean,
      default: false,
    },

    eblApproved: {
      type: Boolean,
      default: false,
    },

    eblRequestPending: {
      type: Boolean,
      default: false,
    },
    eblRejected: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

/**
 * Pre-save hook: hash the password whenever it is modified.
 * This ensures we never accidentally store a plain-text password.
 */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * Instance method: compare a plain-text candidate password against the
 * stored bcrypt hash. Used during login.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
