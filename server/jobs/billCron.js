const cron = require('node-cron');
const MessBill = require('../models/MessBill');
const Expense = require('../models/Expense');
const Student = require('../models/Student');
const StudentConsumption = require('../models/StudentConsumption');
const Hostel = require('../models/Hostel');
const Charge = require('../models/Charge');
const { generateMessBills } = require('../services/calculationService');
const { runInTransaction } = require('../utils/transaction');
const logger = require('../utils/logger');

/**
 * Schedule automatic bill generation
 * Runs on 1st of every month at 00:00
 */
const scheduleBillGeneration = () => {
  // Cron expression: 0 0 1 * * (1st of month at midnight)
  cron.schedule('0 0 1 * *', async () => {
    logger.info('[CRON] Starting automated bill generation');
    
    try {
      // Get current date info
      const now = new Date();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonthIndex = now.getMonth();
      const previousMonthIndex = currentMonthIndex === 0 ? 11 : currentMonthIndex - 1;
      const previousYear = currentMonthIndex === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const billingMonth = `${monthNames[previousMonthIndex]}-${previousYear}`;

      logger.info('[CRON] Generating bills', { billingMonth });

      // Get all hostels
      const hostels = await Hostel.find();

      for (const hostel of hostels) {
        try {
          // Check if expense exists for this hostel and month
          const expense = await Expense.findOne({
            hostelId: hostel._id,
            month: billingMonth,
          });

          if (!expense) {
            logger.warn('[CRON] No expense record for hostel', { hostel: hostel.name, billingMonth });
            continue;
          }

          // Check if bills already exist for this month
          const existingBills = await MessBill.findOne({
            hostelId: hostel._id,
            month: billingMonth,
          });

          if (existingBills) {
            logger.info('[CRON] Bills already exist for hostel', { hostel: hostel.name, billingMonth });
            continue;
          }

          // Get all active students for this hostel
          const students = await Student.find({
            isActive: true,
          }).populate({
            path: 'userId',
            match: { isActive: true },
          });

          const hostelStudents = students.filter(
            s => s.userId && s.userId.hostelId.toString() === hostel._id.toString()
          );

          if (hostelStudents.length === 0) {
            logger.warn('[CRON] No active students for hostel', { hostel: hostel.name });
            continue;
          }

          // Get consumption records
          const consumptions = await StudentConsumption.find({
            studentId: { $in: hostelStudents.map(s => s._id) },
            month: billingMonth,
          });

          const charges = await Charge.find({
            hostelId: hostel._id,
            month: billingMonth,
          });

          await runInTransaction(async (session) => {
            const billPayloads = generateMessBills(expense, hostelStudents, consumptions, { charges });
            await MessBill.insertMany(billPayloads, { session });
            logger.info('[CRON] Bills generated for hostel', {
              hostel: hostel.name,
              billingMonth,
              count: billPayloads.length,
            });
          });
        } catch (hostelError) {
          logger.error('[CRON] Error processing hostel', {
            hostel: hostel.name,
            error: hostelError.message,
            stack: hostelError.stack,
          });
        }
      }

      logger.info('[CRON] Bill generation completed successfully');
    } catch (error) {
      logger.error('[CRON] Error in bill generation', {
        error: error.message,
        stack: error.stack,
      });
    }
  });

  logger.info('[CRON] Bill generation job scheduled (1st of each month at 00:00)');
};

module.exports = {
  scheduleBillGeneration,
};
