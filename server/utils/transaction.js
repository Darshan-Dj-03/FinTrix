const mongoose = require("mongoose");

const runInTransaction = async (executor) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await executor(session);
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  runInTransaction,
};
