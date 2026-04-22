const mongoose = require("mongoose");

const User = require("../models/User");

const CONTACT_FIELDS = "name email phoneNumber role hostelId isActive";

const normalizeContact = (user, fallbackName) => ({
  name: user?.name || fallbackName,
  email: user?.email || "-",
  phoneNumber: user?.phoneNumber || "-",
});

const toObjectIdString = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && value._id) {
    return String(value._id);
  }

  return String(value);
};

const loadPreferredUser = async (userId, role) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const user = await User.findById(userId).select(CONTACT_FIELDS);
  if (!user || user.isActive === false) {
    return null;
  }

  return user.role === role ? user : null;
};

const loadHostelRoleUser = async (hostelId, role) => {
  if (!hostelId || !mongoose.Types.ObjectId.isValid(hostelId)) {
    return null;
  }

  return User.findOne({
    hostelId,
    role,
    isActive: true,
  })
    .select(CONTACT_FIELDS)
    .sort({ updatedAt: -1, createdAt: -1 });
};

const loadGlobalRoleUser = async (role) =>
  User.findOne({
    role,
    isActive: true,
  })
    .select(CONTACT_FIELDS)
    .sort({ updatedAt: -1, createdAt: -1 });

const resolveRoleContact = async ({ hostelId, role, preferredUserId, fallbackName }) => {
  const preferredUser = await loadPreferredUser(preferredUserId, role);
  if (preferredUser) {
    return normalizeContact(preferredUser, fallbackName);
  }

  const hostelUser = await loadHostelRoleUser(hostelId, role);
  if (hostelUser) {
    return normalizeContact(hostelUser, fallbackName);
  }

  const globalUser = await loadGlobalRoleUser(role);
  return normalizeContact(globalUser, fallbackName);
};

const resolveReportContacts = async ({
  hostelId,
  caretakerUserId = null,
  wardenUserId = null,
}) => {
  const normalizedHostelId = toObjectIdString(hostelId);
  const normalizedCaretakerId = toObjectIdString(caretakerUserId);
  const normalizedWardenId = toObjectIdString(wardenUserId);

  const [warden, caretaker] = await Promise.all([
    resolveRoleContact({
      hostelId: normalizedHostelId,
      role: "warden",
      preferredUserId: normalizedWardenId,
      fallbackName: "Warden",
    }),
    resolveRoleContact({
      hostelId: normalizedHostelId,
      role: "caretaker",
      preferredUserId: normalizedCaretakerId,
      fallbackName: "Caretaker",
    }),
  ]);

  return { warden, caretaker };
};

module.exports = {
  resolveReportContacts,
};
