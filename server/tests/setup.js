process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "fintrix-test-secret-123";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fintrix-test";
process.env.SWAGGER_ENABLED = "false";
process.env.NODE_CRON_ENABLED = "false";
process.env.EMAIL_SERVICE = process.env.EMAIL_SERVICE || "gmail";
process.env.EMAIL_USER = process.env.EMAIL_USER || "";
process.env.EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || "";

const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

jest.mock("../utils/emailService", () => ({
  sendPaymentConfirmation: jest.fn().mockResolvedValue({ success: true }),
  sendBillEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPaymentReminder: jest.fn().mockResolvedValue({ success: true }),
}));

let mongoServer;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
});
