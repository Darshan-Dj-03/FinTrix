const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");

const createAuditLog = async ({
  action,
  performedBy,
  role,
  entityId,
  entityType,
  metadata = {},
  session,
}) => {
  const [entry] = await AuditLog.create(
    [
      {
        action,
        performedBy,
        role,
        entityId,
        entityType,
        metadata,
      },
    ],
    session ? { session } : undefined
  );

  logger.info("Audit log created", {
    action,
    entityType,
    entityId: String(entityId),
    performedBy: String(performedBy),
  });

  return entry;
};

module.exports = {
  createAuditLog,
};
