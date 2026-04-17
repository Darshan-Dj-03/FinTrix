const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, "action is required"],
      trim: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "performedBy is required"],
    },
    role: {
      type: String,
      required: [true, "role is required"],
      trim: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "entityId is required"],
    },
    entityType: {
      type: String,
      required: [true, "entityType is required"],
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ performedBy: 1, timestamp: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
